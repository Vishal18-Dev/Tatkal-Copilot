"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Compass,
  Mic,
  ArrowRight,
  Clock,
  Split,
  ShieldCheck,
  Zap,
  Radio,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface PlanEmptyStateProps {
  onSpeak?: () => void;
}

export function PlanEmptyState({ onSpeak }: PlanEmptyStateProps) {
  const { submitGoal } = useJourney();
  const { t } = useLang();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      submitGoal(query.trim());
    }
  };

  const sampleCorridors = [
    {
      code: "MMCT → NDLS",
      badge: "High Rush",
      badgeTone: "amber",
      name: "Mumbai Central to New Delhi",
      trains: "Tejas Rajdhani & August Kranti",
      exhaustionPace: "Under 48 sec",
      progressWidth: "85%",
      progressColor: "bg-amber-500",
      seats: "184 seats",
      successRate: "94.2%",
      goalPrompt: "Mumbai to Delhi tomorrow morning 3A",
    },
    {
      code: "SBC → MAS",
      badge: "Moderate Rush",
      badgeTone: "emerald",
      name: "Bengaluru to Chennai Central",
      trains: "Shatabdi & Vande Bharat Express",
      exhaustionPace: "Under 4 mins",
      progressWidth: "45%",
      progressColor: "bg-emerald-500",
      seats: "240 seats",
      successRate: "98.6%",
      goalPrompt: "Bengaluru to Chennai tomorrow 3A",
    },
    {
      code: "HWH → PURI",
      badge: "High Weekend",
      badgeTone: "amber",
      name: "Howrah to Puri",
      trains: "Dhauli & Puri Vande Bharat Express",
      exhaustionPace: "Under 75 sec",
      progressWidth: "72%",
      progressColor: "bg-amber-500",
      seats: "120 seats",
      successRate: "92.8%",
      goalPrompt: "Howrah to Puri tomorrow morning CC",
    },
  ];

  return (
    <div className="space-y-10 py-2">
      {/* ── TOP SECTION: Hero Search + Copilot Sync Advisor Card ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-8): Big Headline & Input Bar */}
        <div className="lg:col-span-8 space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-black tracking-tight text-ink dark:text-white font-[family-name:var(--font-outfit)] leading-tight">
              {t("planEmpty.headingPrefix")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 dark:from-emerald-400 dark:to-teal-300">
                {t("planEmpty.headingHighlight")}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-ink-soft dark:text-slate-400 max-w-2xl leading-relaxed">
              {t("planEmpty.subtitle")}
            </p>
          </div>

          {/* Search Box Bar */}
          <form
            onSubmit={handleSearch}
            className="relative rounded-2xl border border-line-strong dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-2 shadow-sm transition hover:border-brand/40 focus-within:border-brand dark:focus-within:border-emerald-500"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-2.5 px-2 flex-1">
                <Compass className="h-5 w-5 text-ink-faint dark:text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("planEmpty.placeholder")}
                  className="w-full bg-transparent text-sm text-ink dark:text-white placeholder:text-ink-faint dark:placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (onSpeak) onSpeak();
                    else submitGoal("Mumbai to Delhi tomorrow 3A");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line dark:border-slate-800 bg-surface-muted/60 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-ink dark:text-slate-200 hover:bg-surface-muted dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Mic className="h-3.5 w-3.5 text-brand dark:text-emerald-400 animate-pulse" />
                  <span>{t("planEmpty.speak")}</span>
                </button>

                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand dark:bg-emerald-600 hover:bg-brand-strong dark:hover:bg-emerald-500 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition disabled:opacity-40 cursor-pointer"
                >
                  <span>{t("planEmpty.planJourney")}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Quick Try Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-ink-faint dark:text-slate-500 uppercase tracking-wider text-[0.7rem] flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {t("planEmpty.try")}
            </span>
            {[
              t("planEmpty.sampleQuery1"),
              t("planEmpty.sampleQuery2"),
              t("planEmpty.sampleQuery3"),
              t("planEmpty.sampleQuery4"),
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => submitGoal(chip)}
                className="rounded-full border border-line dark:border-slate-800 bg-surface-muted/50 dark:bg-slate-800/70 px-3 py-1 text-[0.75rem] font-medium text-ink-soft dark:text-slate-300 hover:border-brand/50 dark:hover:border-emerald-500/50 hover:text-brand dark:hover:text-emerald-400 transition cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column (lg:col-span-4): Aarav Copilot AI Advisor Card */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-4 relative overflow-hidden">
            {/* Ambient subtle glow for dark mode */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

            {/* Speech bubble */}
            <div className="relative rounded-xl bg-surface-muted/80 dark:bg-slate-800/80 p-3 text-xs text-ink-soft dark:text-slate-300 leading-relaxed border border-line/60 dark:border-slate-700/60">
              <p className="italic">
                {t("planEmpty.aaravQuote")}
              </p>
            </div>

            {/* Profile Avatar & Title */}
            <div className="flex items-center gap-3.5 pt-1">
              <div className="relative h-13 w-13 rounded-full overflow-hidden border-2 border-emerald-500/60 shrink-0 bg-surface-muted">
                <Image
                  src="/aarav-namaste.jpg"
                  alt="Aarav Copilot AI"
                  fill
                  className="object-cover"
                />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-ink dark:text-white">
                    Aarav
                  </h3>
                  <span className="rounded bg-brand-soft dark:bg-slate-800 px-1.5 py-0.2 text-[0.65rem] font-bold text-brand dark:text-emerald-400">
                    {t("planEmpty.copilotAi")}
                  </span>
                </div>
                <p className="text-[0.75rem] text-ink-soft dark:text-slate-400">
                  {t("planEmpty.advisorTitle")}
                </p>
                <div className="flex items-center gap-1.5 text-[0.7rem] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t("planEmpty.readyQueries")}</span>
                </div>
              </div>
            </div>

            {/* Two Stat telemetry boxes */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60 dark:border-slate-800 text-center">
              <div className="rounded-xl bg-surface-muted/50 dark:bg-slate-800/50 p-2.5">
                <div className="text-[0.65rem] font-bold text-ink-faint dark:text-slate-500 uppercase tracking-wider">
                  {t("planEmpty.nextWindow")}
                </div>
                <div className="text-xs font-bold text-ink dark:text-slate-200 mt-0.5 font-mono">
                  10:00 AM (AC)
                </div>
              </div>

              <div className="rounded-xl bg-surface-muted/50 dark:bg-slate-800/50 p-2.5">
                <div className="text-[0.65rem] font-bold text-ink-faint dark:text-slate-500 uppercase tracking-wider">
                  {t("planEmpty.syncLatency")}
                </div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                  42 ms
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE SECTION: Why plan with Copilot before 10:00 AM? ───────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink dark:text-white">
              {t("planEmpty.whyTitle")}
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400">
              {t("planEmpty.whySub")}
            </p>
          </div>
          <span className="font-mono text-[0.7rem] font-bold tracking-wider rounded-md bg-surface-muted dark:bg-slate-800 px-2.5 py-1 text-emerald-600 dark:text-emerald-400 border border-line dark:border-slate-700">
            {t("planEmpty.preflight")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Window Synchronization */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-surface-muted dark:bg-slate-800 flex items-center justify-center text-ink-soft dark:text-slate-300">
                  <Clock className="h-4.5 w-4.5 text-brand dark:text-emerald-400" />
                </span>
                <span className="font-mono text-[0.7rem] font-bold text-ink-faint dark:text-slate-500">
                  01 / TIMING
                </span>
              </div>
              <h3 className="text-base font-bold text-ink dark:text-white">
                {t("planEmpty.card1Title")}
              </h3>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("planEmpty.card1Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("planEmpty.card1Badge")}</span>
            </div>
          </div>

          {/* Card 2: Dual-Engine Failover */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-surface-muted dark:bg-slate-800 flex items-center justify-center text-ink-soft dark:text-slate-300">
                  <Split className="h-4.5 w-4.5 text-amber-500" />
                </span>
                <span className="font-mono text-[0.7rem] font-bold text-ink-faint dark:text-slate-500">
                  02 / REDUNDANCY
                </span>
              </div>
              <h3 className="text-base font-bold text-ink dark:text-white">
                {t("planEmpty.card2Title")}
              </h3>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("planEmpty.card2Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              <span>{t("planEmpty.card2Badge")}</span>
            </div>
          </div>

          {/* Card 3: Zero Upfront Deduction */}
          <div className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-surface-muted dark:bg-slate-800 flex items-center justify-center text-ink-soft dark:text-slate-300">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                </span>
                <span className="font-mono text-[0.7rem] font-bold text-ink-faint dark:text-slate-500">
                  03 / SAFETY
                </span>
              </div>
              <h3 className="text-base font-bold text-ink dark:text-white">
                {t("planEmpty.card3Title")}
              </h3>
              <p className="text-xs text-ink-soft dark:text-slate-400 leading-relaxed">
                {t("planEmpty.card3Desc")}
              </p>
            </div>
            <div className="pt-3 border-t border-line/60 dark:border-slate-800 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t("planEmpty.card3Badge")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: High-Rush Indian Corridors ──────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-ink dark:text-white">
              {t("planEmpty.corridorsTitle")}
            </h2>
            <p className="text-xs sm:text-sm text-ink-soft dark:text-slate-400">
              {t("planEmpty.corridorsSub")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQuery("NDLS to BCT")}
            className="text-xs font-semibold text-brand dark:text-emerald-400 hover:underline cursor-pointer"
          >
            {t("planEmpty.customCodes")}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sampleCorridors.map((c) => (
            <div
              key={c.code}
              className="rounded-2xl border border-line dark:border-slate-800 bg-surface dark:bg-slate-900/90 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-brand/40 dark:hover:border-emerald-500/40 transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-base text-ink dark:text-white font-[family-name:var(--font-outfit)]">
                    {c.code}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold",
                      c.badgeTone === "amber"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    )}
                  >
                    {c.badge}
                  </span>
                </div>

                <p className="text-xs text-ink-soft dark:text-slate-400 leading-snug">
                  {c.name} • {c.trains}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[0.7rem]">
                    <span className="text-ink-soft dark:text-slate-400">
                      {t("planEmpty.exhaustionPace")}
                    </span>
                    <span className="font-bold text-ink dark:text-slate-200">
                      {c.exhaustionPace}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-muted dark:bg-slate-800 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", c.progressColor)}
                      style={{ width: c.progressWidth }}
                    />
                  </div>
                </div>

                {/* Telemetry row */}
                <div className="flex items-center justify-between text-[0.7rem] text-ink-faint dark:text-slate-400 pt-1">
                  <span>{t("planEmpty.avgDaily")}: {c.seats}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {t("planEmpty.copilotSuccess")}: {c.successRate}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => submitGoal(c.goalPrompt)}
                className="w-full inline-flex items-center justify-between rounded-xl border border-line dark:border-slate-800 bg-surface-muted/40 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs font-bold text-ink dark:text-slate-200 group-hover:bg-brand group-hover:text-white dark:group-hover:bg-emerald-600 dark:group-hover:text-white transition cursor-pointer"
              >
                <span>{t("planEmpty.setCorridor")}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
