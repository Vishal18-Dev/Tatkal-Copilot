import { NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/voice/sarvam";
import { SARVAM_TTS_LANG, VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * Text-to-speech for a client-composed conversational line (grounded answers,
 * re-spoken recommendations). The line itself is always built on the client
 * from real plan data — this route only voices it. Best-effort: a TTS failure
 * returns no audio rather than an error, so the conversation continues
 * caption-only (same non-fatal-TTS principle as the rest of the voice layer).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; lang?: Lang };
  const { text, lang = "en" } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({});
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const tts = await synthesizeSpeech(text, {
      languageCode: SARVAM_TTS_LANG[lang],
      outputAudioCodec: "mp3",
      signal: controller.signal,
    });
    return NextResponse.json({ audioBase64: tts.audios?.[0], audioCodec: "mp3" });
  } catch (err) {
    console.warn(`[api/voice/speak] tts_error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({});
  } finally {
    clearTimeout(timer);
  }
}
