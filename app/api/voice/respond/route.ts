import { NextResponse } from "next/server";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import { voiceProvider } from "@/lib/voice/provider";
import { bcp47For, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import { VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import type { Lang } from "@/lib/i18n";
import type { VoiceErrorKind, VoiceRespondResult } from "@/lib/voice/types";
import type { Plan, StrategyOption } from "@/types";

export const runtime = "nodejs";

/**
 * Turns a transcribed goal into a plan + a short spoken response, rendered in
 * the caller's active language.
 *
 * Grounding contract (do not weaken): this route reuses parseIntentLocally +
 * buildPlanLocally verbatim — the same frozen planner every other screen
 * uses — so every train, fare, confidence word and boarding station a caller
 * hears is real, existing plan data. It never invents availability, PNRs,
 * coaches or berths.
 *
 * Multilingual contract: the response is COMPOSED in English (grounded), then
 * translated into the active language for both the transcript text and the
 * TTS. There is no planner-per-language — one English pipeline, 10 languages
 * out. Translation and TTS are best-effort: either failing degrades to the
 * English text / caption, never an error to the user (spec §24/§27).
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  const body = (await req.json().catch(() => ({}))) as {
    transcript?: string;
    lang?: Lang;
    voiceLang?: string;
    speak?: boolean;
  };
  const { transcript, speak = true } = body;
  const voiceLang: VoiceLang = resolveVoiceLang(body.voiceLang, body.lang);
  const bcp47 = bcp47For(voiceLang);

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

  const englishText = phraseRecommendation(recommended.title, recommended.travelClass);
  let responseText = englishText;

  const hasKey = !!process.env.SARVAM_API_KEY;

  // Render into the active language (skip for English).
  if (hasKey && voiceLang !== "en") {
    try {
      responseText = await voiceProvider.translate(englishText, bcp47);
    } catch {
      responseText = englishText; // best-effort
    }
  }

  const result: VoiceRespondResult = { plan, recommended, responseText, voiceLang };

  if (speak && hasKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
    try {
      const tts = await voiceProvider.synthesize(responseText, bcp47, controller.signal);
      result.audioBase64 = tts.audioBase64;
      result.audioCodec = tts.audioCodec;
    } catch (err) {
      console.warn(
        `[api/voice/respond] tts_error, continuing text-only: ${err instanceof Error ? err.message : err}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  console.info(
    `[api/voice/respond] ok lang=${voiceLang} ms=${Date.now() - startedAt} recommended=${recommended.id} audio=${!!result.audioBase64}`
  );

  return NextResponse.json(result);
}

function resolveVoiceLang(voiceLang: string | undefined, lang: Lang | undefined): VoiceLang {
  if (voiceLang && isVoiceLang(voiceLang)) return voiceLang;
  if (lang && isVoiceLang(lang)) return lang;
  return "en";
}

function fail(errorKind: VoiceErrorKind, status: number, detail?: string) {
  console.warn(`[api/voice/respond] ${errorKind}${detail ? `: ${detail}` : ""}`);
  return NextResponse.json({ errorKind }, { status });
}

/** Short, conversational English — never reads a full UI card aloud. Translated downstream. */
function phraseRecommendation(trainName: string, travelClass: string): string {
  return `I found a strong option for you — ${trainName} in ${travelClass}. Want me to choose it?`;
}
