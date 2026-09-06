import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/sarvam";
import { VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import { bcp47For, fromBcp47, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import type { CallSpeakResult } from "@/lib/calling/types";

export const runtime = "nodejs";

/**
 * Synthesizes one call line via the same server-only Sarvam TTS wrapper
 * voice uses (lib/voice/sarvam.ts) — no separate calling-specific transport,
 * no credentials reach the client. Best-effort: a TTS failure returns no
 * audio rather than an error, so the call continues caption-only instead of
 * breaking (same non-fatal-TTS principle as the voice agent).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    lang?: string;
    voiceLang?: string;
  };
  const { text } = body;
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
  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({} satisfies CallSpeakResult);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const tts = await synthesizeSpeech(text, {
      languageCode,
      outputAudioCodec: "mp3",
      signal: controller.signal,
    });
    const result: CallSpeakResult = { audioBase64: tts.audios?.[0], audioCodec: "mp3" };
    return NextResponse.json(result);
  } catch (err) {
    console.warn(`[api/calling/speak] tts_error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({} satisfies CallSpeakResult);
  } finally {
    clearTimeout(timer);
  }
}
