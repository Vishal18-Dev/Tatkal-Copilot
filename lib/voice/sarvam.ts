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

  // Sarvam validates the file's content-type with an EXACT string match against
  // its allow-list, which contains "audio/webm" but not "audio/webm;codecs=opus".
  // MediaRecorder always tags the Blob with the codec parameter, and the SDK
  // uses the Blob's OWN .type (not the contentType field) when building the
  // upload — so we must RE-WRAP the Blob with the stripped base type, or every
  // real clip is rejected with a 400 "Invalid file type".
  const contentType = (audio.type || "audio/webm").split(";")[0].trim();
  const file = audio.type === contentType ? audio : new Blob([audio], { type: contentType });

  if (mode === "translate") {
    const res = await getClient().speechToText.translate(
      {
        file: { data: file, filename, contentType },
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
      file: { data: file, filename, contentType },
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

const DEFAULT_TRANSLATE_MODEL = process.env.SARVAM_TRANSLATE_MODEL || "sarvam-translate:v1";

export interface TranslateTextOptions {
  targetLanguageCode: string; // e.g. "ta-IN"
  /**
   * Source language. Defaults to "en-IN" because the Copilot always composes
   * its responses in English before translating. (Sarvam rejects "auto" for
   * this endpoint despite the SDK enum listing it.)
   */
  sourceLanguageCode?: string;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Translate a short piece of text into the target language. Used to render the
 * Copilot's (English-composed, grounded) response into the user's active
 * language for both the transcript and TTS — so all 10 languages are genuinely
 * supported without a planner per language. Best-effort: callers fall back to
 * the original English text if this throws.
 */
export async function translateText(text: string, opts: TranslateTextOptions): Promise<string> {
  const res = await getClient().text.translate(
    {
      input: text.slice(0, 1900),
      source_language_code: (opts.sourceLanguageCode ?? "en-IN") as never,
      target_language_code: opts.targetLanguageCode as never,
      model: (opts.model ?? DEFAULT_TRANSLATE_MODEL) as never,
    },
    {
      timeoutInSeconds: Math.ceil(VOICE_REQUEST_TIMEOUT_MS / 1000),
      abortSignal: opts.signal,
    }
  );
  return res.translated_text ?? text;
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
