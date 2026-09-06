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
  | "connecting"
  | "listening"
  | "transcribing"
  | "thinking"
  | "result"
  | "confirming"
  | "speaking"
  | "rest_listening"
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

import type { ConversationalJourneyState } from "@/lib/copilot/journey-state";
import type { Trip } from "@/types";

/** What /api/voice/respond hands back to the client. */
export interface VoiceRespondResult {
  plan: Plan;
  recommended?: StrategyOption | null;
  responseText: string;
  /** base64-encoded audio (whatever codec was requested) — absent if TTS failed or was skipped. */
  audioBase64?: string;
  audioCodec?: string;
  /** The language the responseText + audio are rendered in. */
  voiceLang?: VoiceLang;
  journeyState?: ConversationalJourneyState;
  trip?: Trip;
  voiceState?: "awaiting_clarification" | "showing_results" | "no_results" | "showing_info";
}

/** What /api/voice/transcribe hands back to the client. */
export interface VoiceTranscribeResult {
  transcript: string;
  languageCode: string | null;
}

/** Normalized semantic intent for voice commands across all 10 Indian languages. */
export type SemanticCommandIntent =
  | "yes"
  | "no"
  | "cancel"
  | "repeat"
  | "confirm"
  | "backup"
  | "cheaper"
  | "change"
  | "stop"
  | "unknown";

/** A recognized spoken intent once we're past the initial goal capture. */
export type VoiceCommandKind =
  | "confirm" // "yes", "choose it", "book it", "haan"
  | "reject" // "no", "not that one", "nahi"
  | "repeat" // "say that again", "what?", "dobara"
  | "cancel" // "stop", "cancel", "never mind"
  | "backup"
  | "cheaper"
  | "change"
  | "unknown";

export interface VoiceCommand {
  kind: VoiceCommandKind;
  intent: SemanticCommandIntent;
  raw: string;
  language?: VoiceLang;
  confidence?: number;
}

export interface VoiceConversationOptions {
  /** The active spoken language (one of the 10). Sent to STT/respond/speak. */
  voiceLang: VoiceLang;
  /**
   * Whether the user has explicitly locked a language. When false (auto), the
   * agent responds in the language Sarvam DETECTS from the speech, not the
   * currently-selected one — so "speak Tamil, hear Tamil" works even if the
   * selector still says English. When true, the chosen language always wins.
   */
  locked?: boolean;
  /** Called once the user confirms the recommended option — routes into the
   *  existing /app/plan wizard. Never books anything itself. */
  onConfirm: (goal: string, plan: Plan) => void;
  /** Fired with Sarvam's detected BCP-47 code so the UI can follow the speaker. */
  onDetectLang?: (bcp47: string) => void;
  /**
   * Hands-free mode: keep the mic open, auto-end each turn on a trailing
   * silence (voice-activity detection), and re-open the mic after the agent
   * replies — so the user never has to tap start/stop. Falls back to
   * push-to-talk if the browser lacks the Web Audio API.
   */
  continuous?: boolean;
}

/** Sarvam BCP-47 language codes for all 10 supported voice languages. */
export const SARVAM_STT_LANG: Record<VoiceLang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  ml: "ml-IN",
};

export const SARVAM_TTS_LANG: Record<VoiceLang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  te: "te-IN",
  gu: "gu-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  ml: "ml-IN",
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

/* ------------------------------------------------------------------
   Hands-free (continuous) listening — voice-activity detection.
   The mic stays open; a turn auto-ends after a short silence once
   the speaker has actually said something, and the agent re-opens
   the mic after it finishes replying. Tuned to feel conversational
   without cutting people off mid-sentence.
------------------------------------------------------------------ */
/** RMS amplitude (0–1) above which we count the frame as speech. */
export const VOICE_VAD_RMS_THRESHOLD = 0.02;
/** Trailing silence that ends a turn, once speech has been heard. */
export const VOICE_VAD_SILENCE_MS = 1400;
/** Minimum speech before a turn can auto-end (guards against a stray blip). */
export const VOICE_VAD_MIN_SPEECH_MS = 500;
/** Delay before the mic re-opens after the agent finishes a reply. */
export const VOICE_HANDS_FREE_RESUME_MS = 650;
