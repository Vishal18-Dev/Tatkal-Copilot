import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/voice/sarvam";
import { VOICE_MAX_AUDIO_BYTES, VOICE_REQUEST_TIMEOUT_MS } from "@/lib/voice/types";
import { bcp47For, fromBcp47, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";
import type { VoiceErrorKind } from "@/lib/voice/types";

export const runtime = "nodejs";

function fail(errorKind: VoiceErrorKind, status: number, detail?: string) {
  // Lifecycle logging only — never the audio itself, never credentials.
  console.warn(`[api/voice/transcribe] ${errorKind}${detail ? `: ${detail}` : ""}`);
  return NextResponse.json({ errorKind }, { status });
}

/**
 * Accepts a recorded audio clip (multipart/form-data, field "audio") and
 * returns its transcript via Sarvam AI speech-to-text. Frozen contract: this
 * route only turns audio into text — it never interprets the goal itself,
 * that happens in /api/voice/respond using the existing planner.
 *
 * Accepts canonical `voiceLang` parameter (or legacy `lang`), supporting all
 * 10 Indian languages. When omitted or "auto", Sarvam auto-detects.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("recording_error", 400, "malformed multipart body");
  }

  const audio = form.get("audio");
  const rawLang = (form.get("voiceLang") || form.get("lang")) as string | null;
  const normalized = rawLang?.trim();
  const resolvedLang: VoiceLang | null =
    normalized && isVoiceLang(normalized)
      ? normalized
      : normalized
        ? fromBcp47(normalized)
        : null;
  const languageCode = resolvedLang ? bcp47For(resolvedLang) : undefined;

  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail("recording_error", 400, "no audio field");
  }
  if (audio.size > VOICE_MAX_AUDIO_BYTES) {
    return fail("recording_too_long", 413, `audio ${audio.size}B exceeds cap`);
  }

  if (!process.env.SARVAM_API_KEY) {
    return fail("network_error", 503, "SARVAM_API_KEY not configured");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);

  try {
    const result = await transcribeAudio(audio, "clip.webm", {
      languageCode,
      signal: controller.signal,
    });

    console.info(
      `[api/voice/transcribe] ok detected=${result.language_code ?? "?"} ms=${Date.now() - startedAt} len=${result.transcript.length} audio=${audio.size}B/${audio.type} heard="${result.transcript.slice(0, 200)}"`
    );

    return NextResponse.json({
      transcript: result.transcript ?? "",
      languageCode: result.language_code ?? null,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return fail("timeout", 504, "Sarvam STT timed out");
    }
    return fail("stt_error", 502, err instanceof Error ? err.message : "unknown STT failure");
  } finally {
    clearTimeout(timer);
  }
}
