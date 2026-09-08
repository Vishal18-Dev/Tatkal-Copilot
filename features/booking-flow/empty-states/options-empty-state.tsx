"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Mic,
  ArrowRight,
  Sparkles,
  Zap,
  Clock,
  ArrowLeftRight,
  Search,
  CheckCircle2,
  TrendingUp,
  PlusCircle,
  Globe,
  Hourglass,
  Layers,
} from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface OptionsEmptyStateProps {
  onSpeak?: () => void;
}

export function OptionsEmptyState({ onSpeak }: OptionsEmptyStateProps) {
  const { goTo, submitGoal } = useJourney();
  const { t } = useLang();
  const [origin, setOrigin] = useState("NDLS — New Delhi");
  const [destination, setDestination] = useState("BBS — Bhubaneswar");
  const [schedule, setSchedule] = useState("Tomorrow 10:00 AM (AC Tatkal)");

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const handleFindTrains = () => {
    const fromClean = origin.split("—")[1]?.trim() || origin.split(" ")[0];
    const toClean = destination.split("—")[1]?.trim() || destination.split(" ")[0];
    submitGoal(`${fromClean} to ${toClean} tomorrow 3A`);
  };

  const preCalibratedCorridors = [
    {
      category: "RAJDHANI EXPRESS",
      badge: "High Buffer",
      badgeTone: "emerald",
      trainName: "Tejas Rajdhani (#12951)",
      route: "MMCT → NDLS",
      berths: "144 Berths (3A/2A)",
      exhaustionBuffer: "~4m 10s",
      goal: "Mumbai to Delhi tomorrow 3A",
    },
    {
      category: "SUPERFAST EXPRESS",
      badge: "Fast Exhaust",
      badgeTone: "amber",
      trainName: "Karnataka Express (#12628)",
      route: "NDLS → SBC",
      berths: "96 Berths (3A/SL)",
      exhaustionBuffer: "~2m 30s",
      goal: "Delhi to Bangalore tomorrow 3A",
    },
    {
      category: "SEMI-HIGH SPEED",
      badge: "High Buffer",
      badgeTone: "emerald",
      trainName: "Vande Bharat Express (#20608)",
      route: "MAS → MYS",
      berths: "112 CC / Exec Berths",
      exhaustionBuffer: "~6m 00s",
      goal: "Chennai to Mysore tomorrow CC",
    },
  ];

  return (
    <div className="space-y-8 py-2">
      {/* ── TOP BANNER: Strategy Status Bar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-2 rounded-full border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 px-3.5 py-1 text-ink-soft dark:text-slate-300">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>{t("optionsEmpty.configPhase")}</span>
          <span>·</span>
          <span className="text-ink dark:text-white font-bold">
            {t("optionsEmpty.activeQuota")}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
          <Zap className="h-3.5 w-3.5" />
          <span>{t("optionsEmpty.dualEngineReady")}</span>
        </div>
      </div>

      {/* ── MAIN HERO CARD: Avatar Advice & "No trains selected yet" ─────── */}
      <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-6 sm:p-7 shadow-xs relative overflow-hidden">
        {/* Subtle ambient glow */}
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-amber-500/10 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column (lg:col-span-4): Avatar & Hindi Guidance Bubble */}
          <div className="lg:col-span-4 space-y-3.5 text-center sm:text-left flex flex-col items-center sm:items-start">
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-emerald-500/60 shrink-0 bg-surface-muted shadow-sm">
              <Image
                src="/aarav-namaste.jpg"
                alt="Aarav Copilot"
                fill
                className="object-cover"
              />
              <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 rounded bg-brand-soft dark:bg-slate-800 px-2 py-0.5 text-[0.68rem] font-bold text-brand dark:text-emerald-400 uppercase tracking-wider">
                {t("optionsEmpty.copilotAssistant")}
              </span>
              <p className="text-xs text-ink-soft dark:text-slate-300 italic leading-relaxed">
                {t("optionsEmpty.aaravAdvice")}
              </p>
              <div className="text-[0.7rem] text-ink-faint dark:text-slate-500 font-medium">
                {t("optionsEmpty.multilingualNote")}
              </div>
            </div>
          </div>

          {/* Right Column (lg:col-span-8): Empty State Headline & CTAs */}
          <div className="lg:col-span-8 lg:border-l border-line/70 dark:border-slate-800 lg:pl-8 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase">
                <Hourglass className="h-3.5 w-3.5 animate-pulse" />
                <span>{t("optionsEmpty.waitingQuery")}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-ink dark:text-white font-[family-name:var(--font-outfit)]">
                {t("optionsEmpty.noTrains")}
              </h2>
              <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400 leading-relaxed max-w-xl">
                {t("optionsEmpty.noTrainsSub")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (onSpeak) onSpeak();
                  else submitGoal("Delhi to Bhubaneswar tomorrow 3A");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-3 text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
              >
                <Mic className="h-4 w-4" />
                <span>{t("optionsEmpty.speakJourney")}</span>
              </button>

              <button
                type="button"
                onClick={() => goTo("plan")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line dark:border-slate-700 bg-surface-muted/50 dark:bg-slate-800 px-5 py-3 text-xs font-bold text-ink dark:text-slate-200 hover:bg-surface-muted dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <Globe className="h-4 w-4 text-brand dark:text-emerald-400" />
                <span>{t("optionsEmpty.planCustom")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATION SEARCH STRIP (Inline Quick Finder) ───────────────────── */}
      <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-3 sm:p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Origin */}
          <div className="sm:col-span-4 space-y-1">
            <span className="text-[0.68rem] font-bold text-ink-faint dark:text-slate-400 uppercase tracking-wider pl-1">
              {t("optionsEmpty.originLabel")}
            </span>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
            />
          </div>

          {/* Swap icon */}
          <div className="sm:col-span-1 flex justify-center pt-4 sm:pt-4">
            <button
              type="button"
              onClick={handleSwap}
              title="Swap stations"
              className="h-8 w-8 rounded-full border border-line dark:border-slate-700 bg-surface dark:bg-slate-800 flex items-center justify-center text-ink-soft dark:text-slate-300 hover:text-brand dark:hover:text-emerald-400 transition cursor-pointer"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Destination */}
          <div className="sm:col-span-4 space-y-1">
            <span className="text-[0.68rem] font-bold text-ink-faint dark:text-slate-400 uppercase tracking-wider pl-1">
              {t("optionsEmpty.destLabel")}
            </span>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full rounded-xl border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/80 px-3 py-2 text-xs font-semibold text-ink dark:text-white focus:outline-none focus:border-brand"
            />
          </div>

          {/* Schedule & Find */}
          <div className="sm:col-span-3 space-y-1">
            <span className="text-[0.68rem] font-bold text-ink-faint dark:text-slate-400 uppercase tracking-wider pl-1">
              {t("optionsEmpty.scheduleLabel")}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFindTrains}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand dark:bg-blue-600 hover:bg-brand-strong dark:hover:bg-blue-500 text-white px-4 py-2 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>{t("optionsEmpty.findTrains")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ZERO LATENCY BOOKING ARCHITECTURE ────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[0.68rem] font-bold text-brand dark:text-emerald-400 uppercase tracking-wider">
              {t("optionsEmpty.archBadge")}
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-ink dark:text-white">
              {t("optionsEmpty.howItWorks")}
            </h3>
          </div>
          <p className="text-xs text-ink-soft dark:text-slate-400 max-w-md text-left sm:text-right leading-relaxed">
            {t("optionsEmpty.howItWorksSub")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Primary Anchor */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-7 w-7 rounded-lg bg-blue-500/10 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
                  1
                </span>
                <span className="rounded bg-blue-500/10 dark:bg-blue-950 px-2 py-0.5 text-[0.65rem] font-bold text-blue-600 dark:text-blue-400">
                  {t("optionsEmpty.card1Badge")}
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink dark:text-white">
                {t("optionsEmpty.card1Title")}
              </h4>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("optionsEmpty.card1Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-ink-soft dark:text-slate-400 text-[0.7rem]">
                {t("optionsEmpty.card1Metric")}
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                94.8%
              </span>
            </div>
          </div>

          {/* Card 2: 400ms Dynamic Failover */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-7 w-7 rounded-lg bg-amber-500/10 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs font-mono">
                  2
                </span>
                <span className="rounded bg-amber-500/10 dark:bg-amber-950 px-2 py-0.5 text-[0.65rem] font-bold text-amber-600 dark:text-amber-400">
                  {t("optionsEmpty.card2Badge")}
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink dark:text-white">
                {t("optionsEmpty.card2Title")}
              </h4>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("optionsEmpty.card2Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-ink-soft dark:text-slate-400 text-[0.7rem]">
                {t("optionsEmpty.card2Metric")}
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                ~380ms
              </span>
            </div>
          </div>

          {/* Card 3: Quota Exhaustion Buffer */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-7 w-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs font-mono">
                  3
                </span>
                <span className="rounded bg-emerald-500/10 dark:bg-emerald-950 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
                  {t("optionsEmpty.card3Badge")}
                </span>
              </div>
              <h4 className="text-sm font-bold text-ink dark:text-white">
                {t("optionsEmpty.card3Title")}
              </h4>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("optionsEmpty.card3Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-ink-soft dark:text-slate-400 text-[0.7rem]">
                {t("optionsEmpty.card3Metric")}
              </span>
              <span className="font-mono font-bold text-ink dark:text-slate-200">
                3m 45s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── POPULAR TATKAL CORRIDORS READY TO PAIR ───────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <h3 className="text-lg sm:text-xl font-bold text-ink dark:text-white">
                {t("optionsEmpty.popularTitle")}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400">
              {t("optionsEmpty.popularSub")}
            </p>
          </div>
          <span className="text-[0.7rem] text-ink-faint dark:text-slate-500 font-medium">
            {t("optionsEmpty.telemetryUpdated")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {preCalibratedCorridors.map((c) => (
            <div
              key={c.trainName}
              className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-brand/40 dark:hover:border-emerald-500/40 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-surface-muted dark:bg-slate-800 px-2 py-0.5 text-[0.65rem] font-bold text-ink-soft dark:text-slate-300">
                    {c.category}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[0.65rem] font-bold",
                      c.badgeTone === "amber"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    )}
                  >
                    {c.badge}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-ink dark:text-white">
                    {c.trainName}
                  </h4>
                  <div className="font-mono text-xs font-semibold text-brand dark:text-emerald-400 mt-0.5">
                    {c.route}
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl bg-surface-muted/50 dark:bg-slate-800/60 p-3 text-[0.72rem]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft dark:text-slate-400">
                      {t("optionsEmpty.quotaBerths")}
                    </span>
                    <span className="font-bold text-ink dark:text-slate-200">
                      {c.berths}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-soft dark:text-slate-400">
                      {t("optionsEmpty.exhaustionBuffer")}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ⏱ {c.exhaustionBuffer}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => submitGoal(c.goal)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-line dark:border-slate-700 bg-surface dark:bg-slate-800 hover:bg-surface-muted dark:hover:bg-slate-700 text-ink dark:text-white px-4 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5 text-brand dark:text-emerald-400" />
                <span>{t("optionsEmpty.selectForStrategy")}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
