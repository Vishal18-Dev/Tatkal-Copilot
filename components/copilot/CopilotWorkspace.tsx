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
  HelpCircle,
  Clock,
  Radio,
  Train,
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
import { useJourney } from "@/lib/journey";
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
  const { submitGoal, chooseOption, goTo } = useJourney();
  const { identity, wallet } = useStore();

  const [inputGoal, setInputGoal] = useState(initialGoal ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [prepActive, setPrepActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const convo = useVoiceConversation({
    voiceLang,
    locked,
    continuous: false,
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
      void convo.start();
      const timer = setTimeout(() => {
        convo.askByTap(initialGoal);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [initialGoal, convo]);

  function handleFormSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = inputGoal.trim();
    if (!text || busy) return;
    setInputGoal("");
    askByTap(text);
  }

  function handleMicPress() {
    if (listening) {
      void stop();
    } else if (speaking) {
      stopSpeaking();
    } else {
      void start();
    }
  }

  function handlePrepareTatkal(plan: Plan, option: StrategyOption) {
    setPrepActive(true);
    chooseOption(option.id);
    if (onPrepareTatkal) {
      onPrepareTatkal(plan, option);
    } else {
      submitGoal(
        `from ${plan.intent.from} to ${plan.intent.to}, ${plan.intent.passengers} passenger in ${plan.intent.preferredClass}`
      );
    }
  }

  const originText = result?.journeyState?.originText ?? result?.plan.intent.from;
  const destText = result?.journeyState?.destinationText ?? result?.plan.intent.to;
  const travelDate = result?.journeyState?.travelDate ?? result?.plan.intent.date ?? "Tomorrow";
  const travelClass = result?.journeyState?.travelClass ?? result?.plan.intent.preferredClass ?? "3A";
  const paxCount = result?.journeyState?.passengerCount ?? result?.plan.intent.passengers ?? 1;

  const hasRoute = Boolean(originText && destText);
  const options = result?.plan.options ?? [];
  const primaryOption = result?.recommended && result.recommended.id !== "no_candidate" ? result.recommended : options[0];
  const secondaryOptions = options.filter((o) => o.id !== primaryOption?.id);

  const activeTranscript = interimTranscript || (turns.length > 0 ? turns[turns.length - 1]?.text : "");

  return (
    <div className={cn("mx-auto max-w-4xl space-y-7", className)}>
      {/* Top Banner Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
        <span className="flex items-center gap-2 font-semibold tracking-wide uppercase text-brand">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          {listening ? `● ${t("workspace.liveAudioStream")}` : `● ${t("workspace.ingress")}`}
        </span>

        <div className="flex items-center gap-3">
          {listening ? (
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-soft">
              <Lock className="h-3.5 w-3.5 text-confirm" /> {t("workspace.ephemeralSession")}
            </span>
          ) : (
            <VoiceLangSelect />
          )}
        </div>
      </div>

      {/* Main Title Section */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
          {t("workspace.title")}
        </h1>
        <p className="text-sm text-ink-soft">
          {t("workspace.sub")}
        </p>
      </div>

      {/* Persona Banner — Aarav */}
      <div className="rounded-[var(--radius-lg)] border border-brand/20 bg-gradient-to-r from-surface to-brand-soft/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <CopilotAvatar state={state} voiceState={voiceState as any} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-brand-ink">Aarav</span>
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-brand">
                  {t("agent.guide")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                "{t("workspace.personaSub")}"
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-confirm-soft px-3 py-1 text-xs font-semibold text-confirm shrink-0">
            <span className="h-2 w-2 rounded-full bg-confirm animate-ping" /> {t("agent.activeReady")}
          </span>
        </div>
      </div>

      {/* Hero Natural Language Input Box */}
      <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-4 shadow-[var(--shadow-card)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 space-y-3">
        <form onSubmit={handleFormSubmit} className="space-y-3">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputGoal}
              onChange={(e) => setInputGoal(e.target.value)}
              placeholder={
                listening
                  ? t("workspace.listeningPlaceholder")
                  : t("workspace.placeholder")
              }
              className="w-full bg-transparent pr-12 text-[1.02rem] text-ink placeholder:text-ink-faint focus:outline-none"
            />

            <button
              type="button"
              onClick={handleMicPress}
              aria-label={listening ? t("voice.stop") : t("voice.openLabel")}
              className={cn(
                "absolute right-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-sm",
                listening ? "bg-danger animate-pulse" : "bg-brand hover:bg-brand-strong"
              )}
            >
              <Mic className="h-4 w-4" />
              <span>{t("voice.speakShort")}</span>
            </button>
          </div>

          {/* Sub-bar Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <span className={cn("h-2 w-2 rounded-full", listening ? "bg-danger animate-ping" : "bg-confirm")} />
              <span>{listening ? t("workspace.micActive") : t("workspace.ingressActive")}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMicPress}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                  listening
                    ? "border-danger bg-danger/10 text-danger hover:bg-danger/20"
                    : "border-brand/30 bg-brand-soft/50 text-brand hover:bg-brand-soft"
                )}
              >
                <Mic className="h-3.5 w-3.5" />
                {listening ? t("voice.stop") : t("goal.speakTitle")}
              </button>

              <button
                type="submit"
                disabled={!inputGoal.trim() && !listening}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong disabled:opacity-40"
              >
                {t("planning.findBestTrain")} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Voice Capturing Intent Live Card (Matching Image 2 Mockup) */}
      {(listening || busy || speaking || activeTranscript) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Left Panel: Capturing Intent */}
          <div className="rounded-[var(--radius-lg)] border border-brand/30 bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
                <Mic className="h-4 w-4 animate-pulse text-danger" />
                {t("workspace.capturingIntent")}
              </div>
              <span className="text-[0.68rem] text-ink-faint font-mono">{t("workspace.nlpEngine")}</span>
            </div>

            <div className="text-base font-semibold text-brand-ink leading-relaxed">
              "{activeTranscript || 'Need to go from Mumbai to Delhi tomorrow morning, 2 travellers, prefer reaching early'}"
            </div>

            {/* Detected Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[0.72rem] font-semibold text-brand">
                🛫 MMCT (Mumbai Central)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[0.72rem] font-semibold text-brand">
                🚅 NDLS (New Delhi)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft">
                📅 {t("workspace.tomorrowTatkal")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft">
                👥 {t("workspace.adultsCount", { count: paxCount })}
              </span>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleFormSubmit}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-strong"
              >
                {t("workspace.doneSpeaking")} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleMicPress}
                className="inline-flex items-center gap-1 rounded-full bg-danger/10 border border-danger/30 px-3.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
              >
                {t("workspace.tapToStop")}
              </button>
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
              >
                <Keyboard className="h-3.5 w-3.5" /> {t("workspace.typeInstead")}
              </button>
            </div>
          </div>

          {/* Right Panel: MMCT • Platform 1 & Atomic Clock */}
          <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-confirm" />
                MMCT • Platform 1
              </div>
              <span className="text-[0.68rem] font-semibold text-ink-faint bg-surface-muted px-2 py-0.5 rounded">
                {t("workspace.trackIdle")}
              </span>
            </div>

            <div className="rounded-lg bg-brand-ink text-white p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-confirm">
                  <Train className="h-4 w-4" /> WAP-7 • 12951
                </span>
                <span className="text-[0.68rem] text-white/70">{t("workspace.steamReady")}</span>
              </div>
              <div className="text-[0.72rem] text-white/80">
                {t("workspace.locoReady")}
              </div>
            </div>

            {/* Route timeline */}
            <div className="space-y-1.5 text-xs text-ink-soft pl-2 border-l-2 border-brand/30">
              <div className="flex justify-between font-semibold text-ink">
                <span>● Mumbai Central (MMCT)</span>
                <span>05:00 PM</span>
              </div>
              <div className="text-[0.7rem] text-ink-faint italic pl-3">
                {t("workspace.synthesizingHalts")}
              </div>
              <div className="flex justify-between font-semibold text-ink">
                <span>● New Delhi (NDLS)</span>
                <span>~08:30 AM</span>
              </div>
            </div>

            {/* Atomic Clock Widget */}
            <div className="rounded-lg border border-brand/20 bg-brand-soft/40 p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono font-bold text-brand-ink">
                <Clock className="h-4 w-4 text-brand" />
                <span>{t("workspace.atomicClock")} 09:58:42 AM</span>
              </div>
              <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-[0.68rem] font-semibold text-confirm">
                {t("workspace.acOpensIn")}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Try Asking Suggestions */}
      <div className="space-y-2">
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
              onClick={() => askByTap(q)}
              className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft/50 hover:text-brand-ink"
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>

      {/* Active Sector Readiness Card */}
      <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-brand-ink">
            <Train className="h-4 w-4 text-brand" />
            <span>{t("workspace.sectorReadiness")}</span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[0.7rem] text-confirm font-semibold">
            <span className="h-2 w-2 rounded-full bg-confirm animate-ping" /> {t("workspace.atomicClockSynced")}
          </span>
        </div>

        {/* Route visualization */}
        <div className="flex items-center justify-between gap-2 py-1 text-xs">
          <span className="font-bold text-ink">● MMCT (Mumbai Central • Platform 1)</span>
          <div className="flex-1 h-0.5 bg-line relative mx-2">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-brand-ink px-2 py-0.5 text-[0.65rem] font-bold text-white shadow-xs">
              🚆 12951 TEJAS RAJDHANI • {t("workspace.cabinArmed")}
            </span>
          </div>
          <span className="font-bold text-ink">NDLS ● (New Delhi Junction • Platform 3)</span>
        </div>

        <div className="flex items-center justify-between text-[0.72rem] text-ink-soft border-t border-line/60 pt-2">
          <span>✓ {t("workspace.corridorStatus")}</span>
          <span className="font-semibold text-brand-ink">{t("workspace.tatkalExhaustion")}</span>
        </div>
      </div>

      {/* 3 Value Props Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.watchTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.watchBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> {t("workspace.liveServerSync")}
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Compass className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.backupTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.backupBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> {t("workspace.zeroPanicRouting")}
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">{t("plan.controlTitle")}</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            {t("plan.controlBody")}
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> {t("workspace.biometricGated")}
          </div>
        </div>
      </div>

      {/* 4. Compact Conversation Thread */}
      {turns.length > 0 && (
        <div className="rounded-[var(--radius)] border border-line bg-surface-muted/50 p-3">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
              {t("workspace.threadTitle", { count: turns.length })}
            </span>
            {turns.length > 2 && (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                {showHistory ? (
                  <>
                    {t("workspace.hideHistory")} <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    {t("workspace.showEarlier", { count: turns.length - 2 })} <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mt-2.5 space-y-2">
            {(showHistory ? turns : turns.slice(-2)).map((turn) => (
              <div key={turn.id} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed",
                    turn.role === "user"
                      ? "rounded-br-xs bg-brand text-white font-medium"
                      : "rounded-bl-xs bg-surface border border-line text-ink"
                  )}
                >
                  <div className="text-[0.68rem] font-semibold opacity-70 mb-0.5">
                    {turn.role === "user" ? t("workspace.you") : t("workspace.copilotSpeaker")}
                  </div>
                  <div>{turn.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {travelDate} · {travelClass} · {paxCount} {paxCount > 1 ? "travellers" : "traveller"}
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
