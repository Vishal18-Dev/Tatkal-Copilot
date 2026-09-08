import { NextResponse } from "next/server";
import { voiceProvider } from "@/lib/voice/provider";
import { VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import { bcp47For, fromBcp47, isScriptForLanguage, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import type { CallSpeakResult } from "@/lib/calling/types";

export const runtime = "nodejs";

/**
 * Synthesizes one call line via the same server-only Sarvam TTS wrapper
 * voice uses (lib/voice/sarvam.ts) across all 10 Indian languages.
 * Automatically translates English text into the target language if required,
 * avoids corrupting text already written in the target language's script,
 * supports an optional prefix (e.g. switchAck) without re-translating,
 * and voices it natively using Sarvam's Bulbul TTS.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    lang?: string;
    voiceLang?: string;
    prefix?: string;
  };
  const { text, prefix } = body;
  const rawLang = body.voiceLang || body.lang || "en";
  const normalized = rawLang.trim();
  const resolvedLang: VoiceLang =
    isVoiceLang(normalized)
      ? normalized
      : (fromBcp47(normalized) ?? "en");
  const languageCode = bcp47For(resolvedLang);

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  let spoken = text;
  // If target language is not English and input text is not already in the target script, translate it
  if (resolvedLang !== "en" && !isScriptForLanguage(text, resolvedLang)) {
    try {
      spoken = await voiceProvider.translate(text, languageCode);
    } catch {
      spoken = text;
    }
  }

  // Prepend prefix if provided (e.g. switchAck)
  if (prefix && prefix.trim()) {
    spoken = `${prefix.trim()} ${spoken.trim()}`;
  }

  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({ text: spoken, voiceLang: resolvedLang } satisfies CallSpeakResult);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const tts = await voiceProvider.synthesize(spoken, languageCode, controller.signal);
    const result: CallSpeakResult = {
      audioBase64: tts.audioBase64,
      audioCodec: tts.audioCodec || "mp3",
      text: spoken,
      voiceLang: resolvedLang,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.warn(`[api/calling/speak] tts_error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ text: spoken, voiceLang: resolvedLang } satisfies CallSpeakResult);
  } finally {
    clearTimeout(timer);
  }
}
