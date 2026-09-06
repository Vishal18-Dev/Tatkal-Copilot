import { synthesizeSpeech, transcribeAudio, translateText } from "./sarvam";

/* ============================================================
   VoiceProvider — the speech-infrastructure abstraction.

   Server-only (reads SARVAM_API_KEY via ./sarvam). The API routes
   depend on this interface, not on Sarvam directly, so the mock
   can stand in for deterministic tests/demos and a future realtime
   provider can drop in without touching the routes.

        VoiceProvider
          ├── SarvamVoiceProvider   (real STT / TTS / translate)
          └── MockVoiceProvider     (deterministic, offline)
   ============================================================ */

export interface TranscriptionResult {
  transcript: string;
  languageCode: string | null;
}

export interface SynthesisResult {
  audioBase64?: string;
  audioCodec: string;
}

export interface VoiceProvider {
  readonly id: string;
  /** Audio → text. In translate mode the transcript comes back in English. */
  transcribe(audio: Blob, filename: string, signal?: AbortSignal): Promise<TranscriptionResult>;
  /** English text → target-language text. Returns the input unchanged for English. */
  translate(text: string, targetBcp47: string, signal?: AbortSignal): Promise<string>;
  /** Text → base64 audio in the given language. */
  synthesize(text: string, bcp47: string, signal?: AbortSignal): Promise<SynthesisResult>;
}

export class SarvamVoiceProvider implements VoiceProvider {
  readonly id = "sarvam";

  async transcribe(audio: Blob, filename: string, signal?: AbortSignal): Promise<TranscriptionResult> {
    const res = await transcribeAudio(audio, filename, { signal });
    return { transcript: res.transcript, languageCode: res.language_code };
  }

  async translate(text: string, targetBcp47: string, signal?: AbortSignal): Promise<string> {
    if (!text.trim() || targetBcp47 === "en-IN") return text;
    try {
      return await translateText(text, { targetLanguageCode: targetBcp47, signal });
    } catch {
      // Best-effort: fall back to the English text rather than failing the turn.
      return text;
    }
  }

  async synthesize(text: string, bcp47: string, signal?: AbortSignal): Promise<SynthesisResult> {
    const res = await synthesizeSpeech(text, { languageCode: bcp47, outputAudioCodec: "mp3", signal });
    return { audioBase64: res.audios[0], audioCodec: "mp3" };
  }
}

/**
 * Deterministic, offline provider. Never calls the network. Used by tests and
 * as the last-resort fallback before text-only so a demo never collapses on a
 * transient Sarvam outage (spec §27).
 */
export class MockVoiceProvider implements VoiceProvider {
  readonly id = "mock";

  async transcribe(_audio: Blob, _filename: string, _signal?: AbortSignal): Promise<TranscriptionResult> {
    void _audio;
    void _filename;
    void _signal;
    return { transcript: "Mumbai to Delhi tomorrow morning", languageCode: "en-IN" };
  }

  async translate(text: string, _targetBcp47?: string, _signal?: AbortSignal): Promise<string> {
    void _targetBcp47;
    void _signal;
    // The mock can't translate; it echoes the English so callers still work.
    return text;
  }

  async synthesize(_text: string, _bcp47: string, _signal?: AbortSignal): Promise<SynthesisResult> {
    void _text;
    void _bcp47;
    void _signal;
    // No audio — callers treat a missing audioBase64 as "show text, skip playback".
    return { audioBase64: undefined, audioCodec: "mp3" };
  }
}

/**
 * The active provider. Swap here (or gate on an env flag) to force the mock.
 * Server-only — never import this from client code.
 */
export const voiceProvider: VoiceProvider =
  process.env.VOICE_PROVIDER === "mock" ? new MockVoiceProvider() : new SarvamVoiceProvider();
