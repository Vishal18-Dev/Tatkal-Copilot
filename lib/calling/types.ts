import type { Lang } from "@/lib/i18n";

/** The screens a simulated call walks through. */
export type CallState =
  | "idle" // nothing happening
  | "ringing" // incoming-call screen, waiting for Accept/Decline
  | "connecting"
  | "speaking" // Copilot's line is playing (TTS)
  | "awaiting_reply" // waiting for the user to tap a reply option
  | "ended";

/** One line Copilot says, optionally followed by reply options. */
export interface CallStep {
  id: string;
  text: string;
  /** If present, the call pauses here until the user taps one. */
  replies?: CallReply[];
  /** Step id to continue to when there are no replies (linear script). */
  next?: string;
}

export interface CallReply {
  label: string;
  /** Step id to jump to after this reply. */
  next: string;
  /** Fires once, when this reply is chosen — e.g. hand off to the real app. */
  action?: "open_trip" | "open_plan" | "none";
}

export interface CallScript {
  /** Keyed by step id — id "start" is always the first line. */
  steps: Record<string, CallStep>;
  callerTitle: string;
  callerSubtitle: string;
}

export interface CallSpeakRequest {
  text: string;
  lang?: Lang;
}

export interface CallSpeakResult {
  audioBase64?: string;
  audioCodec?: string;
}
