import { NextResponse } from "next/server";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import { synthesizeSpeech } from "@/lib/voice/sarvam";
import { SARVAM_TTS_LANG, VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import type { Lang } from "@/lib/i18n";
import type { VoiceErrorKind, VoiceRespondResult } from "@/lib/voice/types";
import type { Plan, StrategyOption } from "@/types";

export const runtime = "nodejs";

/**
 * Turns a transcribed goal into a plan + a short spoken response.
 *
 * Grounding contract (do not weaken): this route reuses parseIntentLocally +
 * buildPlanLocally verbatim — the same frozen planner every other screen
 * uses — so every train, fare, confidence word and boarding station a caller
 * hears is real, existing plan data. It never invents availability, PNRs,
 * coaches or berths, and it never calls the planner a second, different way.
 * A TTS failure here degrades to text-only; it never blocks the plan result.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  const body = (await req.json().catch(() => ({}))) as {
    transcript?: string;
    lang?: Lang;
    speak?: boolean;
  };
  const { transcript, lang = "en", speak = true } = body;

  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return fail("planner_error", 400, "transcript required");
  }

  let plan: Plan;
  let recommended: StrategyOption | undefined;
  try {
    const intent = parseIntentLocally(transcript);
    plan = buildPlanLocally(intent);
    recommended = plan.options.find((o) => o.id === plan.recommendedId) ?? plan.options[0];
  } catch (err) {
    return fail("planner_error", 500, err instanceof Error ? err.message : "planner threw");
  }

  if (!recommended) {
    return fail("planner_error", 422, "no options for this route");
  }

  const responseText = phraseRecommendation(recommended.title, recommended.travelClass, lang);
  const result: VoiceRespondResult = { plan, recommended, responseText };

  // Voice output is best-effort — a TTS hiccup must never take down the
  // text/visual result the caller already has (spec §24: partial success).
  if (speak && process.env.SARVAM_API_KEY) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
    try {
      const tts = await synthesizeSpeech(responseText, {
        languageCode: SARVAM_TTS_LANG[lang],
        outputAudioCodec: "mp3",
        signal: controller.signal,
      });
      result.audioBase64 = tts.audios?.[0];
      result.audioCodec = "mp3";
    } catch (err) {
      console.warn(
        `[api/voice/respond] tts_error, continuing text-only: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  console.info(
    `[api/voice/respond] ok lang=${lang} ms=${Date.now() - startedAt} recommended=${recommended.id} audio=${!!result.audioBase64}`
  );

  return NextResponse.json(result);
}

function fail(errorKind: VoiceErrorKind, status: number, detail?: string) {
  console.warn(`[api/voice/respond] ${errorKind}${detail ? `: ${detail}` : ""}`);
  return NextResponse.json({ errorKind }, { status });
}

/** Short, conversational — never reads a full UI card aloud. */
function phraseRecommendation(trainName: string, travelClass: string, lang: Lang): string {
  return lang === "hi"
    ? `मुझे आपके लिए एक अच्छा विकल्प मिला — ${trainName}, ${travelClass} में। क्या मैं इसे चुन लूँ?`
    : `I found a strong option for you — ${trainName} in ${travelClass}. Want me to choose it?`;
}
