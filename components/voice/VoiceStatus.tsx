"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/lib/i18n";
import type { VoiceErrorKind, VoiceState } from "@/lib/voice/types";

const STATE_KEY: Record<VoiceState, string> = {
  idle: "voice.tapToSpeak",
  connecting: "voice.listening",
  listening: "voice.listening",
  rest_listening: "voice.listening",
  transcribing: "voice.transcribing",
  thinking: "voice.thinking",
  result: "voice.resultReady",
  confirming: "voice.confirming",
  speaking: "voice.speaking",
  error: "voice.error.generic",
};

const ERROR_KEY: Record<VoiceErrorKind, string> = {
  mic_permission_denied: "voice.error.micPermission",
  mic_unsupported: "voice.error.micUnsupported",
  recording_error: "voice.error.recording",
  recording_too_short: "voice.error.tooShort",
  recording_too_long: "voice.error.tooLong",
  stt_error: "voice.error.stt",
  planner_error: "voice.error.planner",
  tts_error: "voice.error.generic", // never shown — TTS failure isn't fatal
  network_error: "voice.error.network",
  timeout: "voice.error.timeout",
  cancelled: "voice.error.cancelled",
};

/** The single status line under the mic — "I'm listening...", "Finding your options...", etc. */
export function VoiceStatus({
  state,
  errorKind,
}: {
  state: VoiceState;
  errorKind?: VoiceErrorKind | null;
}) {
  const { t } = useLang();
  const text =
    state === "error" ? t(errorKind ? ERROR_KEY[errorKind] : "voice.error.generic") : t(STATE_KEY[state]);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={cnState(state)}
        role="status"
        aria-live="polite"
      >
        {text}
      </motion.p>
    </AnimatePresence>
  );
}

function cnState(state: VoiceState) {
  const base = "text-center text-[0.98rem] font-medium";
  if (state === "error") return `${base} text-danger`;
  if (state === "listening" || state === "speaking" || state === "connecting" || state === "rest_listening") return `${base} text-brand`;
  return `${base} text-ink-soft`;
}
