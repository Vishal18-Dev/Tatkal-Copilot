"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  X,
  TrainFront,
  Check,
  RotateCcw,
  Loader2,
  Volume2,
  Keyboard,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { useVoiceConversation } from "@/lib/voice/conversation";
import { adjustmentLabel, suggestedQuestions } from "@/lib/voice/adjustments";
import { useLang } from "@/lib/i18n";
import { useVoiceLang } from "@/lib/voice/voice-lang";
import { cn, formatFare } from "@/lib/utils";
import { VoiceWaveform } from "./VoiceWaveform";
import { VoiceLangSelect } from "./VoiceLangSelect";
import type { Plan } from "@/types";

const FALLBACK_ERRORS = new Set(["mic_permission_denied", "mic_unsupported"]);

/**
 * The full-screen, multi-turn voice experience. Speak a journey, then keep
 * talking to refine ("something cheaper", "make it 2A") or ask ("why this
 * train?") — every turn re-runs or reads from the same grounded planner.
 * Deliberately theme-aware (it's an app surface, not a phone call) and free
 * of the mockup's fake telemetry (no "IRCTC NLP Engine", no live atomic clock).
 */
export function VoiceConversation({
  onClose,
  onConfirmGoal,
}: {
  onClose: () => void;
  /**
   * When provided (e.g. mounted inside the /app/plan wizard), the confirmed
   * goal is handed back in-place instead of navigating — so speaking a journey
   * flows straight into the current wizard. Defaults to routing to /app/plan.
   */
  onConfirmGoal?: (goal: string, plan: Plan) => void;
}) {
  const { t, lang } = useLang();
  const { voiceLang, observeDetected } = useVoiceLang();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const convo = useVoiceConversation({
    voiceLang,
    onDetectLang: observeDetected,
    onConfirm: (goal, plan) => {
      if (onConfirmGoal) onConfirmGoal(goal, plan);
      else router.push(`/app/plan?goal=${encodeURIComponent(goal)}`);
      onClose();
    },
  });

  const {
    state,
    errorKind,
    turns,
    result,
    adjustments,
    micSupported,
    elapsedMs,
    maxRecordingMs,
    start,
    stop,
    cancel,
    confirmByTap,
    rejectByTap,
    tapAdjustment,
    askByTap,
    replay,
    stopSpeaking,
    reset,
  } = convo;

  const recording = state === "listening";
  const busy = state === "transcribing" || state === "thinking" || state === "confirming";
  const speaking = state === "speaking";
  const micDisabled = !micSupported || busy;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMicPress() {
    if (recording) stop();
    else if (speaking) stopSpeaking();
    else start();
  }

  function handleClose() {
    cancel();
    onClose();
  }

  const statusText =
    state === "error"
      ? t(errorKind ? `voice.error.${errorMap(errorKind)}` : "voice.error.generic")
      : t(STATUS_KEY[state] ?? "voice.tapToSpeak");

  const detected = useMemo(() => {
    if (!result) return [];
    const { from, to, passengers, preferredClass } = result.plan.intent;
    return [
      from,
      to,
      `${passengers} ${passengers > 1 ? t("results.travellers") : t("results.traveller")}`,
      preferredClass !== "any" ? preferredClass : "",
    ].filter(Boolean);
  }, [result, t]);

  const remainingSec = Math.max(0, Math.ceil((maxRecordingMs - elapsedMs) / 1000));

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[65] flex flex-col bg-canvas"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t("voice.title")}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{t("voice.title")}</div>
            <div className="text-[0.7rem] text-ink-faint">{t("voice.subtitle")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <VoiceLangSelect />
          <button
            onClick={handleClose}
            aria-label={t("voice.close")}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center overflow-y-auto px-5 py-6">
        {/* Hero status */}
        <div className="flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.h1
              key={statusText}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={cn(
                "text-2xl font-bold tracking-tight sm:text-3xl",
                state === "error" ? "text-danger" : recording || speaking ? "text-brand" : "text-brand-ink"
              )}
            >
              {statusText}
            </motion.h1>
          </AnimatePresence>
          {state === "idle" && (
            <p className="mt-2 max-w-sm text-sm text-ink-soft">{t("voice.heroHint")}</p>
          )}
        </div>

        {/* Transcript */}
        {turns.length > 0 && (
          <div className="mt-6 w-full space-y-2.5" role="log" aria-label={t("voice.transcriptLabel")}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
              >
                <span
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-snug",
                    turn.role === "user"
                      ? "rounded-br-sm bg-brand text-white"
                      : "rounded-bl-sm bg-surface-muted text-ink"
                  )}
                >
                  {turn.text}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Recommendation + refine controls */}
        <AnimatePresence>
          {result && (state === "result" || state === "speaking") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-5 w-full"
            >
              {detected.length > 0 && (
                <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                  {detected.map((d) => (
                    <span
                      key={d}
                      className="rounded-full bg-surface-muted px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-[var(--radius-lg)] border border-brand/20 bg-brand-soft/40 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <TrainFront className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[1.05rem] font-semibold text-brand-ink">
                      {result.recommended.title}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {result.recommended.travelClass} · {t("results.arrive")} {result.recommended.arrivalDisplay}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular text-base font-bold text-brand-ink">
                      {formatFare(result.recommended.fare)}
                    </div>
                    <div className="text-[0.68rem] font-semibold text-confirm">
                      {t(`level.${result.recommended.level}`)}
                    </div>
                  </div>
                  {result.audioBase64 && (
                    <button
                      onClick={replay}
                      aria-label={t("voice.replay")}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-brand/10"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Refine chips — spoken or tapped */}
                <div className="mt-3.5 border-t border-brand/15 pt-3">
                  <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
                    {t("voice.refineLabel")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {adjustments.map((adj) => (
                      <button
                        key={adj}
                        onClick={() => tapAdjustment(adj)}
                        className="rounded-full border border-brand/40 bg-surface px-3 py-1.5 text-[0.8rem] font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
                      >
                        {adjustmentLabel(adj, lang)}
                      </button>
                    ))}
                    {suggestedQuestions(lang).map((q) => (
                      <button
                        key={q.key}
                        onClick={() => askByTap(q.label)}
                        className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[0.8rem] font-medium text-ink transition-colors hover:border-brand hover:text-brand-ink"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Commit / restart */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={confirmByTap}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                  {t("voice.confirmYes")}
                </button>
                <button
                  onClick={rejectByTap}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("voice.confirmNo")}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error recovery */}
        {state === "error" && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              onClick={reset}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              <RotateCcw className="h-4 w-4" />
              {t("voice.tryAgain")}
            </button>
            {errorKind && FALLBACK_ERRORS.has(errorKind) && (
              <button
                onClick={() => {
                  onClose();
                  router.push("/app/plan");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand underline-offset-2 hover:underline"
              >
                <Keyboard className="h-3.5 w-3.5" />
                {t("voice.typeInstead")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mic dock */}
      <div className="border-t border-line px-5 py-5">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <VoiceWaveform active={recording || speaking} />
          <button
            onClick={onMicPress}
            disabled={micDisabled}
            aria-label={recording ? t("voice.stop") : speaking ? t("voice.stopPlayback") : t("voice.tapToSpeak")}
            aria-pressed={recording}
            className={cn(
              "relative grid h-16 w-16 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              recording ? "bg-danger" : "bg-brand hover:bg-brand-strong"
            )}
          >
            {recording && (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-danger/40 motion-reduce:animate-none" />
            )}
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : recording ? (
              <Square className="h-5 w-5" fill="currentColor" />
            ) : speaking ? (
              <Volume2 className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
          {recording ? (
            <span className="tabular text-xs font-medium text-ink-faint">
              0:{String(Math.floor(elapsedMs / 1000)).padStart(2, "0")}
              {remainingSec <= 3 && ` · ${t("voice.autoStopSoon")}`}
            </span>
          ) : result ? (
            <span className="text-center text-[0.72rem] text-ink-faint">{t("voice.refineHint")}</span>
          ) : (
            <span className="text-[0.7rem] italic text-ink-faint">{t("voice.simNote")}</span>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

const STATUS_KEY: Record<string, string> = {
  idle: "voice.tapToSpeak",
  listening: "voice.listening",
  transcribing: "voice.transcribing",
  thinking: "voice.thinking",
  result: "voice.resultReady",
  confirming: "voice.confirming",
  speaking: "voice.speaking",
};

function errorMap(kind: string): string {
  const map: Record<string, string> = {
    mic_permission_denied: "micPermission",
    mic_unsupported: "micUnsupported",
    recording_error: "recording",
    recording_too_short: "tooShort",
    recording_too_long: "tooLong",
    stt_error: "stt",
    planner_error: "planner",
    tts_error: "generic",
    network_error: "network",
    timeout: "timeout",
    cancelled: "cancelled",
  };
  return map[kind] ?? "generic";
}
