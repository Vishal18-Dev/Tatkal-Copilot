"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  TrainFront,
  Check,
  RotateCcw,
  Loader2,
  Volume2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ArrowUp,
  HelpCircle,
  Clock,
  Radio,
  Users,
  Compass,
  Lock,
  Keyboard,
  Activity,
  Zap,
} from "lucide-react";
import { useVoiceConversation } from "@/lib/voice/conversation";
import { adjustmentLabel, suggestedQuestions } from "@/lib/voice/adjustments";
import { useLang } from "@/lib/i18n";
import { useVoiceLang } from "@/lib/voice/voice-lang";
import { useOptionalJourney } from "@/lib/journey";
import { useStore } from "@/lib/store";
import { cn, formatFare } from "@/lib/utils";
import { CopilotAvatar } from "./CopilotAvatar";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";
import { VoiceLangSelect } from "@/components/voice/VoiceLangSelect";
import type { Plan, StrategyOption } from "@/types";

export interface CopilotWorkspaceProps {
  initialGoal?: string;
  className?: string;
  onPrepareTatkal?: (plan: Plan, option: StrategyOption) => void;
}

export function CopilotWorkspace({
  initialGoal,
  className,
  onPrepareTatkal,
}: CopilotWorkspaceProps) {
  const { t, lang } = useLang();
  const { voiceLang, locked, observeDetected } = useVoiceLang();
  const router = useRouter();
  const journey = useOptionalJourney();
  const submitGoal = journey?.submitGoal ?? ((g: string) => router.push(`/app/plan?goal=${encodeURIComponent(g)}`));
  const chooseOption = journey?.chooseOption ?? (() => {});
  const goTo = journey?.goTo ?? (() => router.push("/app/plan"));
  const { identity, wallet } = useStore();

  const [composerText, setComposerText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [prepActive, setPrepActive] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);

  const convo = useVoiceConversation({
    voiceLang,
    locked,
    continuous: continuousMode,
    onDetectLang: observeDetected,
    onConfirm: (goalText, plan) => {
      if (plan.options.length > 0) {
        const opt = plan.options[0];
        handlePrepareTatkal(plan, opt);
      }
    },
  });

  const {
    state,
    errorKind,
    turns,
    interimTranscript,
    result,
    adjustments,
    micSupported,
    start,
    stop,
    stopSpeaking,
    reset,
    tapAdjustment,
    askByTap,
    sendText,
    replay,
  } = convo;

  const listening = state === "listening" || state === "rest_listening" || state === "connecting";
  const busy = state === "transcribing" || state === "thinking" || state === "confirming";
  const speaking = state === "speaking";

  const voiceState = result?.voiceState ?? (busy ? "thinking" : listening ? "listening" : "idle");

  // Initial goal trigger
  const startedGoalRef = useRef(false);
  useEffect(() => {
    if (initialGoal && !startedGoalRef.current) {
      startedGoalRef.current = true;
      setContinuousMode(true);
      void convo.start();
      const timer = setTimeout(() => {
        void convo.sendText(initialGoal);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialGoal, convo]);

  // When actionPlan or booking confirmation triggers, activate preparation view automatically
  useEffect(() => {
    if (
      result?.toolUsed === "open_booking_flow" ||
      (result?.actionPlan?.route && !result.actionPlan.requiresConfirmation)
    ) {
      if (result.plan && result.plan.options.length > 0) {
        const opt =
          result.recommended && result.recommended.id !== "no_candidate"
            ? result.recommended
            : result.plan.options[0];
        handlePrepareTatkal(result.plan, opt);
      } else {
        router.push("/app/plan");
      }
    } else if (
      result?.actionPlan?.route ||
      result?.toolUsed === "request_booking_confirmation" ||
      result?.toolUsed === "prepare_journey"
    ) {
      setPrepActive(true);
      if (result.plan && result.plan.options.length > 0) {
        const opt =
          result.recommended && result.recommended.id !== "no_candidate"
            ? result.recommended
            : result.plan.options[0];
        if (opt) {
          chooseOption(opt.id);
        }
      }
    }
  }, [result, chooseOption]);

  function handleFormSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = composerText.trim();
    if (!text || busy) return;
    setComposerText("");
    textareaRef.current?.focus();

    const isAffirmative = /^(?:yes|proceed|go ahead|haan|continue|confirm|sure)\b/i.test(text);
    if (isAffirmative && result?.plan && result.plan.options.length > 0) {
      const opt =
        result.recommended && result.recommended.id !== "no_candidate"
          ? result.recommended
          : result.plan.options[0];
      handlePrepareTatkal(result.plan, opt);
      return;
    }

    void sendText(text);
  }

  function handleMicPress() {
    if (listening) {
      setContinuousMode(false);
      void stop();
    } else if (speaking) {
      stopSpeaking();
      setContinuousMode(false);
    } else {
      setContinuousMode(true);
      void start();
    }
  }

  function handlePrepareTatkal(plan: Plan, option: StrategyOption) {
    setPrepActive(true);
    chooseOption(option.id);
    if (journey?.setPlan) {
      journey.setPlan(plan);
    }
    if (onPrepareTatkal) {
      onPrepareTatkal(plan, option);
    } else {
      // Store the voice-resolved plan in sessionStorage so the plan page
      // can restore it directly — without calling submitGoal() which resets
      // plan to null and re-runs generatePlan(), throwing away all voice context.
      try {
        sessionStorage.setItem(
          "tatkal_voice_result",
          JSON.stringify({
            plan,
            chosenOptionId: option.id,
            journeyState: result?.journeyState,
          })
        );
      } catch {
        /* ignore — private browsing / Safari ITP */
      }
      router.push("/app/plan?from_voice=1");
    }
  }


  const originText = result?.journeyState?.originText ?? result?.plan.intent.from;
  const destText = result?.journeyState?.destinationText ?? result?.plan.intent.to;
  const travelDate = result?.journeyState?.travelDate ?? result?.plan.intent.date ?? "Tomorrow";
  const travelClass = result?.journeyState?.travelClass ?? result?.plan.intent.preferredClass ?? "3A";
  const paxCount = result?.journeyState?.passengerCount ?? result?.plan.intent.passengers;

  const hasRoute = Boolean(originText && destText);
  const options = result?.plan.options ?? [];
  const primaryOption = result?.recommended && result.recommended.id !== "no_candidate" ? result.recommended : options[0];
  const secondaryOptions = options.filter((o) => o.id !== primaryOption?.id);

  const activeTranscript = interimTranscript || (turns.length > 0 ? turns[turns.length - 1]?.text : "");

  // Auto-scroll compact conversation history when turns or interim updates arrive
  useEffect(() => {
    if (historyContainerRef.current) {
      historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
    }
  }, [turns, interimTranscript]);

  const composerStatus = useMemo(() => {
    if (state === "error" || errorKind) {
      return {
        status: "error" as const,
        label: t("errors.somethingWentWrong"),
        dotColor: "bg-danger",
      };
    }
    if (listening) {
      return {
        status: "listening" as const,
        label: t("agent.listening"),
        dotColor: "bg-danger animate-ping",
      };
    }
    if (state === "transcribing") {
      return {
        status: "transcribing" as const,
        label: t("agent.thinking"),
        dotColor: "bg-brand animate-pulse",
      };
    }
    if (busy) {
      return {
        status: "thinking" as const,
        label: t("agent.thinking"),
        dotColor: "bg-brand animate-pulse",
      };
    }
    if (speaking) {
      return {
        status: "speaking" as const,
        label: t("agent.speaking"),
        dotColor: "bg-confirm animate-pulse",
      };
    }
    return {
      status: "idle" as const,
      label: t("agent.talkToCopilot"),
      dotColor: "bg-confirm",
    };
  }, [state, errorKind, listening, busy, speaking, t]);

  const placeholderText = useMemo(() => {
    if (listening) return t("workspace.listeningPlaceholder");
    if (turns.length === 0) return t("workspace.placeholder");
    return t("copilot.askPlaceholder");
  }, [listening, turns.length, t]);

  const lastAgentTurn = turns.filter((t) => t.role === "agent").slice(-1)[0];
  const agentSpeech =
    result?.responseText ||
    lastAgentTurn?.text ||
    (listening
      ? t("workspace.listeningPlaceholder")
      : busy
      ? t("agent.thinking")
      : t("workspace.personaSub"));

  const agentSubtext =
    listening
      ? t("workspace.locoReady")
      : busy
      ? t("workspace.atomicClockSynced")
      : result
      ? t("workspace.sectorReadiness")
      : t("workspace.sub");

  return (
    <div className={cn("mx-auto max-w-5xl space-y-8", className)}>
      {/* Top Banner Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint border-b border-line/60 pb-3">
        <div className="flex items-center gap-2 font-semibold tracking-wide text-brand">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[0.72rem] font-bold text-brand">
            <span>🇮🇳</span>
            <span>{t("brand")}</span>
            <span className="text-ink-faint">·</span>
            <span className="text-brand font-medium">{t("workspace.ingressActive")}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <VoiceLangSelect />
        </div>
      </div>

      {/* Hero Section: Two-Column Layout (Matching Design) */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Input and Suggestions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6A00]/10 px-2.5 py-0.5 text-[0.72rem] font-bold text-[#FF6A00]">
              <Sparkles className="h-3 w-3" />
              <span>{t("agent.copilot")}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl lg:text-[2.1rem] leading-[1.2]">
              {t("workspace.title")}
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              {t("workspace.sub")}
            </p>
          </div>

          {/* Unified Hero Conversation & Input Card */}
          <div className="rounded-2xl border border-line-strong bg-surface p-4 shadow-sm transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 space-y-3">
            {/* Compact Conversation History (when turns exist) */}
            {turns.length > 0 && (
              <div
                ref={historyContainerRef}
                role="log"
                aria-live="polite"
                aria-label="Conversation history"
                className="max-h-56 overflow-y-auto space-y-2.5 pr-1 mb-2 scroll-smooth border-b border-line/60 pb-3"
              >
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={cn(
                      "flex",
                      turn.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs",
                        turn.role === "user"
                          ? "rounded-br-xs bg-brand text-white font-medium"
                          : "rounded-bl-xs bg-surface-muted/90 border border-line text-ink"
                      )}
                    >
                      <div className="text-[0.68rem] font-semibold opacity-75 mb-0.5">
                        {turn.role === "user" ? "You" : "Aarav"}
                      </div>
                      <div className="whitespace-pre-wrap">{turn.text}</div>
                    </div>
                  </div>
                ))}

                {/* Live interim transcript bubble during voice speech */}
                {listening && interimTranscript && interimTranscript.trim() && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-xs bg-brand/70 text-white/90 px-3.5 py-2 text-xs italic animate-pulse">
                      <div className="text-[0.68rem] font-semibold opacity-75 mb-0.5">
                        You (speaking...)
                      </div>
                      <div>{interimTranscript.trim()}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div className="relative flex items-end gap-2 rounded-xl bg-surface-muted/40 p-1.5 border border-line/60 focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/10 transition">
                <textarea
                  ref={textareaRef}
                  rows={turns.length > 0 ? 1 : 2}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleFormSubmit();
                    }
                  }}
                  aria-label={t("copilot.askPlaceholder")}
                  placeholder={placeholderText}
                  className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm sm:text-base text-ink placeholder:text-ink-faint focus:outline-none leading-relaxed"
                />

                {/* Circular Mic Button */}
                <button
                  type="button"
                  onClick={handleMicPress}
                  aria-label={listening ? t("workspace.tapToStop") : t("copilot.speak")}
                  className={cn(
                    "relative h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-xs transition-all active:scale-95",
                    listening
                      ? "bg-danger animate-pulse ring-4 ring-danger/20"
                      : speaking
                      ? "bg-confirm ring-4 ring-confirm/20"
                      : "bg-[#FF6A00] hover:bg-[#E55F00] ring-2 ring-[#FF6A00]/20"
                  )}
                >
                  {listening ? (
                    <Mic className="h-4 w-4 animate-pulse" />
                  ) : speaking ? (
                    <Volume2 className="h-4 w-4 animate-bounce" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!composerText.trim() || busy}
                  aria-label={t("copilot.send")}
                  className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-brand text-white shadow-xs transition-all hover:bg-brand-strong disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              {/* Sub-bar Inside Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <div className="flex items-center gap-2 text-ink-soft" aria-live="polite">
                  <span className={cn("h-2 w-2 rounded-full", composerStatus.dotColor)} />
                  <span className="font-medium text-[0.76rem]">
                    {composerStatus.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMicPress}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      listening
                        ? "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
                        : "border-brand/20 bg-brand-soft/70 text-brand hover:bg-brand-soft"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    <span>{listening ? t("workspace.listeningPlaceholder") : t("copilot.speak")}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Try Asking Suggestions */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">
              {t("workspace.tryAsking")}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                t("workspace.sampleQuery1"),
                t("workspace.sampleQuery2"),
                t("workspace.sampleQuery3"),
                t("workspace.sampleQuery4"),
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setComposerText("");
                    void sendText(q);
                  }}
                  className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft/50 hover:text-brand-ink"
                >
                  "{q}"
                </button>
              ))}
            </div>
            <div className="pt-1 text-[0.72rem] text-ink-faint flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-confirm" />
              <span>{t("workspace.ephemeralSession")}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Aarav Sharma Copilot Card */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-line-strong bg-surface p-5 shadow-sm space-y-4 text-center relative overflow-hidden">
            {/* Top Speech Bubble */}
            <div className="rounded-xl border border-[#FFE0B2] dark:border-brand/20 bg-[#FFF8EE] dark:bg-brand-soft/20 p-3 text-left space-y-1 relative shadow-2xs">
              <div className="text-xs font-bold text-brand-ink flex items-start gap-1">
                <span className="text-[#FF6A00] font-serif text-sm leading-none">“</span>
                <span className="flex-1 leading-snug">{agentSpeech}</span>
                <span className="text-[#FF6A00] font-serif text-sm leading-none">”</span>
              </div>
              <p className="text-[0.7rem] text-ink-soft pl-2.5">
                {agentSubtext}
              </p>
            </div>

            {/* Center Avatar */}
            <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
              <div className="relative h-28 w-28 rounded-full p-1 bg-gradient-to-b from-[#FFAE66] to-[#FFD8B3] shadow-md">
                <img
                  src="/aarav-namaste.jpg"
                  alt="Aarav · Tatkal Copilot"
                  className="h-full w-full rounded-full object-cover shadow-xs"
                />
              </div>
            </div>

            {/* Status badge below avatar */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted/80 px-3 py-0.5 text-[0.68rem] font-bold text-ink-soft">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    listening ? "bg-danger animate-ping" : speaking ? "bg-confirm animate-pulse" : "bg-confirm"
                  )}
                />
                <span>
                  {listening
                    ? t("agent.listening")
                    : speaking
                    ? t("agent.speaking")
                    : busy
                    ? t("agent.thinking")
                    : t("agent.activeReady")}
                </span>
              </span>
            </div>

            {/* Name & Title */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-base font-extrabold text-brand-ink">Aarav</span>
                <span className="rounded-full bg-[#FF6A00]/10 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-[#FF6A00]">
                  {t("agent.copilot").toUpperCase()}
                </span>
              </div>
              <p className="text-[0.72rem] text-ink-soft">
                {t("workspace.corridorStatus")}
              </p>
            </div>

            {/* Capability Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-3 py-1 text-[0.7rem] font-medium text-ink">
                ⚡ {t("workspace.zeroPanicRouting")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-3 py-1 text-[0.7rem] font-medium text-ink">
                🛡️ {t("workspace.biometricGated")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Search Link */}
      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => setShowManual((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-brand transition-colors"
        >
          <span>🔀 {t("goal.or")}</span>
        </button>
      </div>

      {/* Manual Input Expandable Drawer */}
      {showManual && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="rounded-2xl border border-line-strong bg-surface p-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="text-[0.72rem] font-semibold text-ink-soft">{t("plan.form.origin")}</label>
              <input
                type="text"
                placeholder="e.g. MMCT / Mumbai"
                defaultValue={originText || ""}
                onChange={(e) => setComposerText(`From ${e.target.value} to ${destText || "Delhi"}`)}
                className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[0.72rem] font-semibold text-ink-soft">{t("plan.form.destination")}</label>
              <input
                type="text"
                placeholder="e.g. NDLS / Delhi"
                defaultValue={destText || ""}
                onChange={(e) => setComposerText(`From ${originText || "Mumbai"} to ${e.target.value}`)}
                className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[0.72rem] font-semibold text-ink-soft">{t("plan.form.class")}</label>
              <select
                defaultValue={travelClass || "3A"}
                className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-brand"
              >
                <option value="3A">3A (AC 3 Tier)</option>
                <option value="2A">2A (AC 2 Tier)</option>
                <option value="1A">1A (First AC)</option>
                <option value="SL">SL (Sleeper)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFormSubmit}
                className="w-full rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong"
              >
                {t("plan.form.cta")}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 3 Value Props Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.watchTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.watchBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Live server sync
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Compass className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.backupTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.backupBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Zero-panic routing
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.controlTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.controlBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Biometric consent gated
          </div>
        </div>
      </div>



      {/* 5. Awaiting Clarification View */}
      {voiceState === "awaiting_clarification" && result?.responseText && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[var(--radius-lg)] border border-brand/40 bg-brand-soft/60 p-5 text-center shadow-sm"
        >
          <CopilotAvatar state={state} voiceState="awaiting_clarification" size="lg" className="mx-auto mb-2" />
          <h2 className="text-lg font-bold text-brand-ink">{result.responseText}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {t("workspace.tellStartingCity")}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["Pune", "Mumbai", "Bangalore", "Delhi", "Chennai", "Kolkata"].map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => askByTap(city)}
                className="rounded-full border border-brand/30 bg-surface px-4 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
              >
                {city}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* 6. Compact Journey Summary & Refinement Chips */}
      {hasRoute && (
        <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-ink">
                {originText} → {destText}
              </span>
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                {travelDate} · {travelClass} · {paxCount !== undefined ? `${paxCount} ${paxCount > 1 ? "travellers" : "traveller"}` : "Passengers required"}
              </span>
            </div>

            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" /> {t("workspace.startNewJourney")}
            </button>
          </div>

          {/* Quick Refinement Chips */}
          <div className="mt-3.5 border-t border-line pt-3">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              {t("workspace.refineTitle")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: t("refine.changeDate"), q: "Change date to day after tomorrow" },
                { label: t("refine.changeClass"), q: "Change class to 2A" },
                { label: t("refine.tryStation"), q: "Try another station near origin" },
                { label: t("refine.fastest"), q: "Fastest option" },
                { label: t("refine.cheapest"), q: "Cheaper option" },
                { label: t("refine.dontUse", { station: originText ?? "" }), q: `Don't use ${originText ?? ""} station` },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => askByTap(chip.q)}
                  className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand-ink"
                >
                  {chip.label}
                </button>
              ))}
              {adjustments.map((adj) => (
                <button
                  key={adj}
                  type="button"
                  onClick={() => tapAdjustment(adj)}
                  className="rounded-full border border-brand/40 bg-surface px-3 py-1 text-xs font-semibold text-brand-ink transition-colors hover:bg-brand-soft"
                >
                  {adjustmentLabel(adj, lang)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. Hero Recommended Option & Alternatives */}
      {voiceState === "showing_results" && primaryOption && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              ⭐ {t("results.recommended")}
            </h2>
            {result?.audioBase64 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <Volume2 className="h-3.5 w-3.5" /> {t("results.replay")}
              </button>
            )}
          </div>

          {/* Primary Candidate Card */}
          <div className="rounded-[var(--radius-lg)] border-2 border-brand bg-gradient-to-br from-surface to-brand-soft/30 p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white">
                    <TrainFront className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold text-brand-ink">
                      {primaryOption.title}
                    </div>
                    <div className="text-xs text-ink-soft">
                      {primaryOption.boardingStationName} → {destText}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-ink pt-1">
                  <span className="font-semibold">{primaryOption.departureDisplay} → {primaryOption.arrivalDisplay}</span>
                  <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                    {primaryOption.travelClass} · Direct
                  </span>
                </div>

                {primaryOption.why && (
                  <div className="mt-3 rounded-lg border border-brand/20 bg-surface/80 p-3 text-xs leading-relaxed text-ink-soft">
                    <div className="font-semibold text-brand-ink mb-1">{t("results.why")}</div>
                    <div>{primaryOption.why}</div>
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right sm:self-stretch sm:flex sm:flex-col sm:justify-between">
                <div>
                  <div className="text-2xl font-bold text-brand-ink tabular">
                    {formatFare(primaryOption.fare)}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-confirm-soft px-2.5 py-0.5 text-xs font-semibold text-confirm mt-1">
                    {primaryOption.level} {t("results.confirmation")}
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => handlePrepareTatkal(result!.plan, primaryOption)}
                  className="mt-4 sm:mt-0 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong"
                >
                  {t("results.prepareCTA")} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Other Verified Options */}
          {secondaryOptions.length > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {t("results.otherOptions", { count: secondaryOptions.length })}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {secondaryOptions.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-brand/40"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="truncate text-sm font-semibold text-ink">{opt.title}</div>
                      <div className="text-xs text-ink-soft">
                        {opt.travelClass} · {opt.departureDisplay}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-ink">{formatFare(opt.fare)}</div>
                      <button
                        type="button"
                        onClick={() => handlePrepareTatkal(result!.plan, opt)}
                        className="mt-1 text-xs font-semibold text-brand hover:underline"
                      >
                        {t("results.selectOption")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Truthful Empty State Card */}
      {voiceState === "no_results" && (
        <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-6 text-center shadow-sm">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-caution-soft text-caution">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-ink">{t("results.noFound")}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-soft">
            {`I couldn't find a verified ${travelClass} train journey matching ${originText} → ${destText} for ${travelDate}.`}
          </p>

          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              {t("results.recoveryActions")}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                t("refine.changeDate"),
                t("refine.changeClass"),
                t("refine.tryStation"),
                "Refine by voice",
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => askByTap(action)}
                  className="rounded-full border border-line-strong bg-surface-muted px-4 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand-ink"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 9. Progressive Tatkal Preparation View */}
      {prepActive && primaryOption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-lg)] border border-confirm/30 bg-confirm-soft/20 p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-confirm/20 pb-3">
            <div className="flex items-center gap-2 text-confirm">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-base font-bold">{t("prep.workspaceTitle")}</h2>
            </div>
            <span className="text-xs font-semibold text-confirm">{t("prep.windowOpens")}</span>
          </div>

          <div className="grid gap-2 text-xs text-ink-soft sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>{t("prep.journeySelected")} <strong>{primaryOption.title}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>{t("prep.classLabel")} <strong>{primaryOption.travelClass}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>{t("prep.identityReadiness")} <strong>{identity.status === "verified" ? t("prep.verified") : t("home.ready")}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>{t("prep.walletCoverage")} <strong>{wallet.balance >= primaryOption.fare ? t("prep.covered") : t("home.ready")}</strong></span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => goTo("vault")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-strong"
            >
              Continue to Traveller Setup <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Footer Disclaimer */}
      <div className="text-center text-[0.72rem] text-ink-faint flex items-center justify-center gap-1.5 pt-2 border-t border-line">
        <Lock className="h-3.5 w-3.5 text-confirm" />
        <span>{t("workspace.footerPrivacy")}</span>
      </div>
    </div>
  );
}
