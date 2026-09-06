import { NextResponse } from "next/server";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { Trip } from "@/types";
import type { WalletState } from "@/lib/payments/types";
import type { IdentityReadiness } from "@/lib/identity/types";
import type { Lang } from "@/lib/i18n";
import type { QuickReply, WhatsAppRespondResult } from "@/lib/whatsapp/types";

export const runtime = "nodejs";

/**
 * Powers the simulated WhatsApp thread. Same grounding contract as voice:
 * this route ONLY calls the existing frozen planner (parseIntentLocally +
 * buildPlanLocally) or the Unified Copilot Brain (executeCopilotTurn) — no
 * second railway-parsing engine, no invented trains, fares or confidence.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    stage?: "goal" | "preference" | "copilot" | "turn";
    lang?: Lang;
    trip?: Trip;
    wallet?: WalletState;
    identity?: IdentityReadiness;
  };
  const { message, stage = "goal", lang = "en" } = body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  if (stage === "copilot" || stage === "turn") {
    const turnResult = await executeCopilotTurn({
      channel: "whatsapp",
      text: message,
      trip: body.trip,
      wallet: body.wallet,
      identity: body.identity,
      language: lang,
    });
    return NextResponse.json({
      reply: turnResult.speakText || turnResult.speakEnglish,
      actionPlan: turnResult.actionPlan,
      toolUsed: turnResult.toolUsed,
      validation: turnResult.validation,
    });
  }

  const intent = parseIntentLocally(message);

  if (stage === "goal") {
    const result: WhatsAppRespondResult = {
      reply: phraseUnderstood(intent, lang),
      quickReplies: [
        qr("best_chance", lang),
        qr("fastest", lang),
        qr("cheapest", lang),
      ],
    };
    return NextResponse.json(result);
  }

  // stage === "preference" — message already carries the appended preference phrase.
  const plan = buildPlanLocally(intent);
  const recommended = plan.options.find((o) => o.id === plan.recommendedId) ?? plan.options[0];
  if (!recommended) {
    return NextResponse.json({ error: "No trains found for that route." }, { status: 422 });
  }

  const result: WhatsAppRespondResult = {
    reply: phraseRecommendation(recommended.title, recommended.travelClass, recommended.arrivalDisplay, lang),
    quickReplies: [qr("show_other", lang)],
    cta: { label: lang === "hi" ? "हाँ, यह तैयार करें" : "Yes, prepare this", goal: message },
    plan,
    recommended,
  };
  return NextResponse.json(result);
}

function qr(kind: QuickReply["kind"], lang: Lang): QuickReply {
  const labels: Record<QuickReply["kind"], { en: string; hi: string }> = {
    best_chance: { en: "Best chance", hi: "सबसे अच्छा मौका" },
    fastest: { en: "Fastest", hi: "सबसे तेज़" },
    cheapest: { en: "Lowest fare", hi: "सबसे कम किराया" },
    show_other: { en: "Show other options", hi: "अन्य विकल्प दिखाएँ" },
  };
  return { kind, label: lang === "hi" ? labels[kind].hi : labels[kind].en };
}

function phraseUnderstood(intent: ReturnType<typeof parseIntentLocally>, lang: Lang): string {
  return lang === "hi"
    ? `समझ गया — ${intent.from} से ${intent.to}, ${intent.passengers} यात्री। सबसे ज़्यादा ज़रूरी क्या है?`
    : `Got it — ${intent.from} to ${intent.to}, ${intent.passengers} traveller${intent.passengers > 1 ? "s" : ""}. What matters most?`;
}

function phraseRecommendation(train: string, cls: string, arrival: string, lang: Lang): string {
  return lang === "hi"
    ? `मुझे एक अच्छा विकल्प मिला: *${train}, ${cls}*. पहुँचता है ${arrival}. क्या मैं इसे तैयार कर दूँ?`
    : `I found a good option: *${train}, ${cls}*. Arrives ${arrival}. Want me to prepare this?`;
}
