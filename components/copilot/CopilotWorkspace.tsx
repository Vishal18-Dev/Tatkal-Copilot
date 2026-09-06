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
          {listening ? "● VOICE JOURNEY PLANNER • LIVE AUDIO STREAM" : "● CONVERSATIONAL INGRESS / Voice & Plain Text"}
        </span>

        <div className="flex items-center gap-3">
          {listening ? (
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-ink-soft">
              <Lock className="h-3.5 w-3.5 text-confirm" /> End-to-end client ephemeral session
            </span>
          ) : (
            <VoiceLangSelect />
          )}
        </div>
      </div>

      {/* Main Title Section */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
          Where do you need to go?
        </h1>
        <p className="text-sm text-ink-soft">
          Tell me in plain words or type. I'll figure out the railway complexity.
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
                  COPILOT GUIDE
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft">
                "Namaste! Tell me your journey in plain words — I'll monitor Tatkal quotas and secure your seat tomorrow."
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-confirm-soft px-3 py-1 text-xs font-semibold text-confirm shrink-0">
            <span className="h-2 w-2 rounded-full bg-confirm animate-ping" /> Active & Ready
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
                  ? "Listening... speak naturally in English, Hindi or Hinglish"
                  : 'e.g., "Mumbai to Delhi tomorrow before 8 AM" or "Delhi jaana hai kal subah with parents"'
              }
              className="w-full bg-transparent pr-12 text-[1.02rem] text-ink placeholder:text-ink-faint focus:outline-none"
            />

            <button
              type="button"
              onClick={handleMicPress}
              aria-label={listening ? "Stop listening" : "Voice input"}
              className={cn(
                "absolute right-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-all shadow-sm",
                listening ? "bg-danger animate-pulse" : "bg-brand hover:bg-brand-strong"
              )}
            >
              <Mic className="h-4 w-4" />
              <span>Voice</span>
            </button>
          </div>

          {/* Sub-bar Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <span className={cn("h-2 w-2 rounded-full", listening ? "bg-danger animate-ping" : "bg-confirm")} />
              <span>{listening ? "Microphone active • Latency < 140ms" : "Speech & Plain Text Ingress Active"}</span>
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
                {listening ? "Stop Listening" : "Speak your journey"}
              </button>

              <button
                type="submit"
                disabled={!inputGoal.trim() && !listening}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong disabled:opacity-40"
              >
                Find my best train <ArrowRight className="h-3.5 w-3.5" />
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
                CAPTURING INTENT
              </div>
              <span className="text-[0.68rem] text-ink-faint font-mono">IRCTC NLP Engine v2.4</span>
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
                📅 Tomorrow (Tatkal Open 10 AM)
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft">
                👥 {paxCount} Adults
              </span>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleFormSubmit}
                className="inline-flex items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-strong"
              >
                Done speaking <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleMicPress}
                className="inline-flex items-center gap-1 rounded-full bg-danger/10 border border-danger/30 px-3.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
              >
                Tap to stop
              </button>
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
              >
                <Keyboard className="h-3.5 w-3.5" /> Type instead
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
                TRACK 01 IDLE
              </span>
            </div>

            <div className="rounded-lg bg-brand-ink text-white p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-confirm">
                  <Train className="h-4 w-4" /> WAP-7 • 12951
                </span>
                <span className="text-[0.68rem] text-white/70">Steam Ready • Idling</span>
              </div>
              <div className="text-[0.72rem] text-white/80">
                Listening to route preferences... Locomotive ready to plot your itinerary.
              </div>
            </div>

            {/* Route timeline */}
            <div className="space-y-1.5 text-xs text-ink-soft pl-2 border-l-2 border-brand/30">
              <div className="flex justify-between font-semibold text-ink">
                <span>● Mumbai Central (MMCT)</span>
                <span>05:00 PM</span>
              </div>
              <div className="text-[0.7rem] text-ink-faint italic pl-3">
                Synthesizing intermediate halts...
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
                <span>IRCTC ATOMIC CLOCK 09:58:42 AM</span>
              </div>
              <span className="rounded-full bg-confirm-soft px-2.5 py-0.5 text-[0.68rem] font-semibold text-confirm">
                AC Opens in 1m 18s
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Try Asking Suggestions */}
      <div className="space-y-2">
        <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">
          TRY ASKING:
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "Mumbai to Delhi tomorrow morning",
            "Delhi se Varanasi 3A kal shaam",
            "Bengaluru to Chennai early morning",
            "Reaching Kolkata before 10 AM with senior citizens",
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
            <span>Active Sector Readiness: Western Rail Corridor</span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[0.7rem] text-confirm font-semibold">
            <span className="h-2 w-2 rounded-full bg-confirm animate-ping" /> 10:00:00 AM IST Atomic clock syncd
          </span>
        </div>

        {/* Route visualization */}
        <div className="flex items-center justify-between gap-2 py-1 text-xs">
          <span className="font-bold text-ink">● MMCT (Mumbai Central • Platform 1)</span>
          <div className="flex-1 h-0.5 bg-line relative mx-2">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded bg-brand-ink px-2 py-0.5 text-[0.65rem] font-bold text-white shadow-xs">
              🚆 12951 TEJAS RAJDHANI • Cabin armed
            </span>
          </div>
          <span className="font-bold text-ink">NDLS ● (New Delhi Junction • Platform 3)</span>
        </div>

        <div className="flex items-center justify-between text-[0.72rem] text-ink-soft border-t border-line/60 pt-2">
          <span>✓ Track clear • Western Corridor active • Tatkal opens tomorrow at 10:00 AM (AC) / 11:00 AM (Non-AC)</span>
          <span className="font-semibold text-brand-ink">Avg Tatkal Exhaustion: 2m 14s</span>
        </div>
      </div>

      {/* 3 Value Props Cards (Matching Image 3 Mockup) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">We watch the clock</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            No need to sit repeatedly refreshing CAPTCHA screens. Copilot synchronizes with IRCTC atomic time down to the exact millisecond.
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Live server sync
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <Compass className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">Backup ready</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            If your chosen Rajdhani exhausts its quota in seconds, seamless automatic failover switches to your confirmed backup train instantly.
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Zero-panic routing
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 space-y-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-brand-ink">You're always in control</h3>
          <p className="text-xs leading-relaxed text-ink-soft">
            We never deduct money or autofill bank OTPs without your explicit biometric authorization. Your payment never leaves safe hands.
          </p>
          <div className="text-[0.68rem] font-semibold text-confirm flex items-center gap-1 pt-1">
            <Check className="h-3.5 w-3.5" /> Biometric consent gated
          </div>
        </div>
      </div>

      {/* 4. Compact Conversation Thread */}
      {turns.length > 0 && (
        <div className="rounded-[var(--radius)] border border-line bg-surface-muted/50 p-3">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
              Conversation Thread ({turns.length})
            </span>
            {turns.length > 2 && (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                {showHistory ? (
                  <>
                    Hide history <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Show earlier ({turns.length - 2}) <ChevronDown className="h-3.5 w-3.5" />
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
                    {turn.role === "user" ? "You" : "Aarav (Copilot)"}
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
            Tell me your starting city or station to complete journey resolution.
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
              <RotateCcw className="h-3.5 w-3.5" /> Start new journey
            </button>
          </div>

          {/* Quick Refinement Chips */}
          <div className="mt-3.5 border-t border-line pt-3">
            <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              Refine Journey by Voice or Tap
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Change date", q: "Change date to day after tomorrow" },
                { label: "Change class", q: "Change class to 2A" },
                { label: "Try another station", q: "Try another station near origin" },
                { label: "Fastest", q: "Fastest option" },
                { label: "Cheapest", q: "Cheaper option" },
                { label: `Don't use ${originText} station`, q: `Don't use ${originText} station` },
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
              ⭐ Recommended Candidate
            </h2>
            {result?.audioBase64 && (
              <button
                type="button"
                onClick={replay}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <Volume2 className="h-3.5 w-3.5" /> Replay explanation
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
                    <div className="font-semibold text-brand-ink mb-1">Why this option:</div>
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
                    {primaryOption.level} Confirmation
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => handlePrepareTatkal(result!.plan, primaryOption)}
                  className="mt-4 sm:mt-0 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition-colors hover:bg-brand-strong"
                >
                  Prepare for Tatkal <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Other Verified Options */}
          {secondaryOptions.length > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Other Verified Options ({secondaryOptions.length})
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
                        Select option →
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
          <h2 className="text-lg font-bold text-ink">No verified journey found</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-soft">
            {`I couldn't find a verified ${travelClass} train journey matching ${originText} → ${destText} for ${travelDate}.`}
          </p>

          <div className="mt-4 border-t border-line pt-4">
            <div className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
              Recovery Actions
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Change date",
                "Change class",
                "Try another station",
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
              <h2 className="text-base font-bold">Tatkal Preparation Workspace</h2>
            </div>
            <span className="text-xs font-semibold text-confirm">Window opens 10:00 AM</span>
          </div>

          <div className="grid gap-2 text-xs text-ink-soft sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>Journey selected: <strong>{primaryOption.title}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>Class: <strong>{primaryOption.travelClass}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>Identity readiness: <strong>{identity.status === "verified" ? "Verified" : "Ready"}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-confirm shrink-0" />
              <span>Rail Wallet coverage: <strong>{wallet.balance >= primaryOption.fare ? "Covered" : "Ready"}</strong></span>
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
        <span>Voice audio is processed privately for your journey search only. Never recorded or shared.</span>
      </div>
    </div>
  );
}
