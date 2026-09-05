import { SarvamAIClient } from "sarvamai";
import { VOICE_REQUEST_TIMEOUT_MS } from "./types";

/**
 * Thin server-side wrapper around the official Sarvam AI SDK
 * (https://github.com/sarvamai/sarvam-javascript-sdk) — speech-to-text (STT)
 * and text-to-speech (TTS).
 *
 * NEVER import this from client code: it reads SARVAM_API_KEY, which must
 * stay server-only. Both API routes under app/api/voice/* are the only
 * callers.
 *
 * Model/mode/speaker are configurable via env vars so operators can move to
 * a newer Saaras/Bulbul generation without a code change:
 *   SARVAM_STT_MODEL   (default "saaras:v3")
 *   SARVAM_STT_MODE    (default "translate" — see transcribeAudio() below)
 *   SARVAM_TTS_MODEL   (default "bulbul:v3")
 *   SARVAM_TTS_SPEAKER (default "shubh")
 */

let client: SarvamAIClient | null = null;

function getClient(): SarvamAIClient {
  const apiSubscriptionKey = process.env.SARVAM_API_KEY;
  if (!apiSubscriptionKey) throw new Error("SARVAM_API_KEY is not configured");
  if (!client) client = new SarvamAIClient({ apiSubscriptionKey });
  return client;
}

const DEFAULT_STT_MODEL = process.env.SARVAM_STT_MODEL || "saaras:v3";
// "translate" mode asks Sarvam's STT to hand back English text regardless of
// the spoken language — this is what lets Hindi/Hinglish input reach the
// existing (English-only, frozen) planner without us writing a second
// railway-goal parser. See lib/voice/README notes in respond/route.ts.
const DEFAULT_STT_MODE = (process.env.SARVAM_STT_MODE || "translate") as
  | "transcribe"
  | "translate"
  | "verbatim"
  | "translit"
  | "codemix";
const DEFAULT_TTS_MODEL = process.env.SARVAM_TTS_MODEL || "bulbul:v3";
const DEFAULT_TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || "shubh";

export interface TranscribeOptions {
  /** BCP-47 code, e.g. "en-IN" / "hi-IN". Omit to let Sarvam auto-detect. */
  languageCode?: string;
  model?: string;
  /** "translate" (default) returns English text; "transcribe" keeps native script. */
  mode?: "transcribe" | "translate" | "verbatim" | "translit" | "codemix";
  signal?: AbortSignal;
}

export interface TranscribeResponse {
  request_id: string | null;
  transcript: string;
  language_code: string | null;
}

/** Send a recorded audio blob to Sarvam STT and get back the transcript. */
export async function transcribeAudio(
  audio: Blob,
  filename: string,
  opts: TranscribeOptions = {}
): Promise<TranscribeResponse> {
  const model = opts.model ?? DEFAULT_STT_MODEL;
  const mode = opts.mode ?? DEFAULT_STT_MODE;
  const requestOptions = {
    timeoutInSeconds: Math.ceil(VOICE_REQUEST_TIMEOUT_MS / 1000),
    abortSignal: opts.signal,
  };

  if (mode === "translate") {
    const res = await getClient().speechToText.translate(
      {
        file: { data: audio, filename, contentType: audio.type || "audio/webm" },
        model: model as never,
      },
      requestOptions
    );
    return {
      request_id: res.request_id ?? null,
      transcript: res.transcript ?? "",
      language_code: res.language_code ?? null,
    };
  }

  const res = await getClient().speechToText.transcribe(
    {
      file: { data: audio, filename, contentType: audio.type || "audio/webm" },
      model: model as never,
      mode: mode as never,
      language_code: (opts.languageCode ?? "unknown") as never,
    },
    requestOptions
  );
  return {
    request_id: res.request_id ?? null,
    transcript: res.transcript ?? "",
    language_code: res.language_code ?? null,
  };
}

export interface SynthesizeOptions {
  languageCode: string; // e.g. "en-IN"
  speaker?: string;
  model?: string;
  pace?: number;
  outputAudioCodec?: "mp3" | "linear16" | "wav" | "opus" | "flac" | "aac";
  signal?: AbortSignal;
}

export interface SynthesizeResponse {
  request_id: string;
  audios: string[]; // base64-encoded audio, one per input chunk
}

/** Turn a short spoken response into base64 audio via Sarvam TTS. */
export async function synthesizeSpeech(
  text: string,
  opts: SynthesizeOptions
): Promise<SynthesizeResponse> {
  const res = await getClient().textToSpeech.convert(
    {
      text: text.slice(0, 2400),
      language_code: opts.languageCode as never,
      speaker: (opts.speaker ?? DEFAULT_TTS_SPEAKER) as never,
      model: (opts.model ?? DEFAULT_TTS_MODEL) as never,
      pace: opts.pace ?? 1.0,
      output_audio_codec: (opts.outputAudioCodec ?? "mp3") as never,
    },
    {
      timeoutInSeconds: Math.ceil(VOICE_REQUEST_TIMEOUT_MS / 1000),
      abortSignal: opts.signal,
    }
  );

  return { request_id: res.request_id ?? "", audios: res.audios ?? [] };
}
