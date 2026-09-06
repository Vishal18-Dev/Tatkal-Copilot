import type { Plan, StrategyOption } from "@/types";
import type { Lang } from "@/lib/i18n";
import type { VoiceLang } from "./languages";

/**
 * The visible states the voice UI walks through. Named to match the app's
 * existing short/lowercase state-id convention (see lib/agent.ts,
 * lib/journey.tsx) rather than SCREAMING_CASE, but they map 1:1 onto the
 * product spec's IDLE → LISTENING → PROCESSING → RESPONDING →
 * AWAITING_CONFIRMATION → COMPLETED pipeline:
 *
 *   idle          = IDLE
 *   listening     = LISTENING
 *   transcribing  = PROCESSING (uploading + STT)
 *   thinking      = PROCESSING (planner)
 *   speaking      = RESPONDING (TTS playback)
 *   result        = AWAITING_CONFIRMATION
 *   confirming    = COMPLETED (handing off to /app/plan)
 *   error         = any failure — see VoiceErrorKind for which one
 */
export type VoiceState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "result"
  | "confirming"
  | "speaking"
  | "error";

/** Every failure mode the voice layer can hit, each with its own graceful copy. */
export type VoiceErrorKind =
  | "mic_permission_denied"
  | "mic_unsupported"
  | "recording_error"
  | "recording_too_short"
  | "recording_too_long"
  | "stt_error"
  | "planner_error"
  | "tts_error" // never fatal — recovered from automatically, kept for logging
  | "network_error"
  | "timeout"
  | "cancelled";

/** One turn in the on-screen transcript (mirrors a call log). */
export interface VoiceTurn {
  id: string;
  role: "user" | "agent";
  text: string;
  final: boolean;
}

/** What /api/voice/respond hands back to the client. */
export interface VoiceRespondResult {
  plan: Plan;
  recommended: StrategyOption;
  responseText: string;
  /** base64-encoded audio (whatever codec was requested) — absent if TTS failed or was skipped. */
  audioBase64?: string;
  audioCodec?: string;
  /** The language the responseText + audio are rendered in. */
  voiceLang?: VoiceLang;
}

/** What /api/voice/transcribe hands back to the client. */
export interface VoiceTranscribeResult {
  transcript: string;
  languageCode: string | null;
}

/** A recognized spoken intent once we're past the initial goal capture. */
export type VoiceCommandKind =
  | "confirm" // "yes", "choose it", "book it", "haan"
  | "reject" // "no", "not that one", "nahi"
  | "repeat" // "say that again", "what?", "dobara"
  | "cancel" // "stop", "cancel", "never mind"
  | "unknown";

export interface VoiceCommand {
  kind: VoiceCommandKind;
  raw: string;
}

export interface VoiceConversationOptions {
  /** The active spoken language (one of the 10). Sent to STT/respond/speak. */
  voiceLang: VoiceLang;
  /** Called once the user confirms the recommended option — routes into the
   *  existing /app/plan wizard. Never books anything itself. */
  onConfirm: (goal: string, plan: Plan) => void;
  /** Fired with Sarvam's detected BCP-47 code so the UI can follow the speaker. */
  onDetectLang?: (bcp47: string) => void;
}

/** Sarvam BCP-47 language codes we actually use (subset of the full list). */
export const SARVAM_STT_LANG: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

export const SARVAM_TTS_LANG: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

/* ------------------------------------------------------------------
   Push-to-talk recording limits. Keep a real clip short and bounded —
   this is a "tell me your journey" capture, not an open line.
------------------------------------------------------------------ */
export const VOICE_MAX_RECORDING_MS = 15_000;
export const VOICE_MIN_RECORDING_MS = 400;
export const VOICE_MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8MB
export const VOICE_REQUEST_TIMEOUT_MS = 20_000;
export const VOICE_ACCEPTED_MIME_PREFIXES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"];
