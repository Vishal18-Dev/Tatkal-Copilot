import { NextResponse } from "next/server";
import { voiceProvider } from "@/lib/voice/provider";
import { bcp47For, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import { VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import type { Lang } from "@/lib/i18n";

export const runtime = "nodejs";

/**
 * Voice a client-composed conversational line (grounded answers, re-spoken
 * recommendations). The line is always built on the client from real plan /
 * tool data — this route renders it into the active language and voices it.
 *
 * Returns the (possibly translated) `text` alongside the audio so the caller
 * can show the SAME words in the transcript that were spoken — keeping the
 * two-sided transcript genuinely multilingual. Best-effort throughout: a
 * translation or TTS failure returns the original text with no audio rather
 * than an error, so the conversation continues caption-only.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    lang?: Lang;
    voiceLang?: string;
  };
  const { text } = body;
  const voiceLang: VoiceLang = resolveVoiceLang(body.voiceLang, body.lang);
  const bcp47 = bcp47For(voiceLang);

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (!process.env.SARVAM_API_KEY) {
    return NextResponse.json({ text });
  }

  let spoken = text;
  if (voiceLang !== "en") {
    try {
      spoken = await voiceProvider.translate(text, bcp47);
    } catch {
      spoken = text;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const tts = await voiceProvider.synthesize(spoken, bcp47, controller.signal);
    return NextResponse.json({ text: spoken, audioBase64: tts.audioBase64, audioCodec: tts.audioCodec });
  } catch (err) {
    console.warn(`[api/voice/speak] tts_error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ text: spoken });
  } finally {
    clearTimeout(timer);
  }
}

function resolveVoiceLang(voiceLang: string | undefined, lang: Lang | undefined): VoiceLang {
  if (voiceLang && isVoiceLang(voiceLang)) return voiceLang;
  if (lang && isVoiceLang(lang)) return lang;
  return "en";
}
