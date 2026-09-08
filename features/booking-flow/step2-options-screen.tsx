"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Clock,
  Train,
  Check,
  RotateCcw,
  Mic,
  Lock,
} from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { OptionsEmptyState } from "./empty-states/options-empty-state";

export function Step2OptionsScreen() {
  const { plan, chosenOption, recoveryOption, autoFallbackEnabled, setAutoFallbackEnabled, goTo } = useJourney();
  const { t } = useLang();

  if (!plan || !plan.options || plan.options.length === 0) {
    return <OptionsEmptyState />;
  }

  const primary = chosenOption || plan?.options[0];
  const backup = recoveryOption || plan?.options[1] || plan?.options[0];

  const fromCode = plan?.intent.fromCode || "MMCT";
  const toCode = plan?.intent.toCode || "NDLS";

  const primaryTrainName = primary?.title || "Tejas Rajdhani Express";
  const primaryNumber = primary?.trainNumber || "12951";
  const primaryFare = primary?.fare || 2845;
  const primaryDep = primary?.departureDisplay || "16:55";
  const primaryArr = primary?.arrivalDisplay || "08:32";
  const primaryClass = primary?.travelClass || "3A (AC 3 Tier)";

  const backupTrainName = backup?.title || "August Kranti Rajdhani";
  const backupNumber = backup?.trainNumber || "12953";
  const backupFare = backup?.fare || 2845;

  return (
    <div className="space-y-6">
      {/* Top Header info bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-2 text-ink-soft">
          <span className="flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1 font-bold text-brand-ink">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span>STRATEGY LOCKED</span>
            <span className="text-ink-faint">·</span>
            <span className="text-emerald-600 dark:text-emerald-400">Primary & 1-Click Backup Ready</span>
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[0.75rem] text-ink-soft">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>IRCTC Master Link: Synced</span>
          </span>
          <span>·</span>
          <span className="font-bold text-brand-ink">Step 2 of 4</span>
        </div>
      </div>

      {/* Main Headline & Eyebrow */}
      <div>
        <div className="text-[0.72rem] font-bold uppercase tracking-wider text-brand">
          {t("step2.badge")}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl lg:text-[2.1rem] leading-tight">
          {t("step2.headline")}
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-ink-soft">
          {t("step2.subheadline")}
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols): Primary & Backup Cards */}
        <div className="space-y-5 lg:col-span-7">
          {/* Primary Recommendation Card */}
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-surface p-5 shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                <span>{t("step2.primarySuitability")}</span>
              </span>
              <span className="font-mono text-xs font-bold text-ink-soft">
                Class: {primaryClass}
              </span>
            </div>

            {/* Train Title & Fare */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-extrabold text-brand-ink">
                  {primaryTrainName}{" "}
                  <span className="font-mono text-base font-bold text-ink-soft">
                    #{primaryNumber}
                  </span>
                </h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  15h 37m non-stop prestige express · Punctuality 98.6%
                </p>
              </div>

              <div className="text-right">
                <div className="text-2xl font-extrabold text-brand-ink">
                  ₹{primaryFare.toLocaleString("en-IN")}
                </div>
                <div className="text-[0.72rem] font-medium text-ink-faint">
                  Dynamic Tatkal / pass.
                </div>
              </div>
            </div>

            {/* Route & Track Line */}
            <div className="rounded-xl border border-line/60 bg-surface-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <div>
                  <div className="text-lg font-bold text-brand-ink">{primaryDep}</div>
                  <div className="text-xs text-ink-soft">{fromCode} (PF 1)</div>
                </div>

                <div className="flex flex-col items-center flex-1 px-4">
                  <span className="text-[0.68rem] font-medium text-ink-faint mb-1">
                    1,386 km · 15h 37m
                  </span>
                  <div className="relative w-full flex items-center">
                    <span className="h-2 w-2 rounded-full bg-brand" />
                    <div className="h-0.5 w-full bg-brand/40" />
                    <span className="h-2 w-2 rounded-full bg-danger" />
                  </div>
                  <span className="text-[0.65rem] font-bold text-emerald-600 mt-1">
                    Direct Priority Track
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-brand-ink">
                    {primaryArr}{" "}
                    <span className="text-xs text-brand font-semibold">+1</span>
                  </div>
                  <div className="text-xs text-ink-soft">{toCode} (PF 2)</div>
                </div>
              </div>
            </div>

            {/* Stat Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-surface p-3 space-y-0.5">
                <div className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">
                  <Train className="h-3 w-3 text-ink-faint" />
                  <span>Available Tatkal Berths</span>
                </div>
                <div className="text-base font-bold text-brand-ink">144 Berths</div>
                <div className="text-[0.7rem] text-ink-soft">In AC 3 Tier pool</div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-3 space-y-0.5">
                <div className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1">
                  <Clock className="h-3 w-3 text-ink-faint" />
                  <span>Tatkal Exhaust Buffer</span>
                </div>
                <div className="text-base font-bold text-brand-ink">~4 min 10 sec</div>
                <div className="text-[0.7rem] text-emerald-600 font-semibold">
                  Copilot books in 0.82s
                </div>
              </div>
            </div>

            {/* Why this train */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-xs leading-relaxed text-brand-ink">
              <strong className="font-bold text-brand">Why this train:</strong> Reaches NDLS at 08:32 AM sharp. The 4-minute historical exhaustion window provides our algorithm a secure 3-attempt fallback execution buffer.
            </div>

            {/* Primary confirmation badge */}
            <div className="flex items-center justify-between border-t border-line/60 pt-3 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Selected as Primary Target</span>
              </span>

              <span className="font-mono text-ink-soft text-[0.75rem]">
                Tatkal AC Window 10:00 AM
              </span>
            </div>
          </div>

          {/* Backup Strategy Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Zap className="h-3.5 w-3.5" />
                <span>Configured 400ms Failover Backup</span>
              </span>
              <span className="font-mono text-xs font-bold text-ink-soft">
                Class: {primaryClass}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-brand-ink">
                  {backupTrainName}{" "}
                  <span className="font-mono text-sm text-ink-soft font-semibold">
                    #{backupNumber}
                  </span>
                </h3>
                <p className="text-xs text-ink-soft mt-0.5 font-mono">
                  {fromCode} 17:10 → NZM (Hazrat Nizamuddin) 10:55 · 112 Tatkal Berths
                </p>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-brand-ink">
                  ₹{backupFare.toLocaleString("en-IN")}
                </div>
                <div className="text-[0.7rem] text-ink-faint font-medium">Same Quota Tier</div>
              </div>
            </div>

            {/* Failover Trigger Rule */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-brand-ink">
              <strong className="font-bold text-amber-600 dark:text-amber-400">
                Failover Trigger Rule:
              </strong>{" "}
              If {primaryTrainName} sells out in under 12 seconds or encounters IRCTC payment concurrency drop, engine reroutes instantly to {backupTrainName} without re-entering OTP or passenger details.
            </div>

            {/* Auto-fallback toggle */}
            <div className="flex items-center justify-between border-t border-line/60 pt-3 text-xs">
              <div>
                <div className="font-bold text-brand-ink">Auto-fallback enabled</div>
                <div className="text-ink-soft text-[0.72rem]">
                  Recommended for high-demand {fromCode}–{toCode} holiday rush
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoFallbackEnabled}
                onClick={() => setAutoFallbackEnabled(!autoFallbackEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  autoFallbackEnabled ? "bg-brand" : "bg-line-strong"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    autoFallbackEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => goTo("plan")}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted cursor-pointer"
            >
              <Mic className="h-3.5 w-3.5 text-brand" />
              <span>{t("step2.back")}</span>
            </button>

            <button
              type="button"
              onClick={() => goTo("prepare")}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-brand-strong cursor-pointer"
            >
              <span>{t("step2.cta")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (5 cols): Station Master Guidance & Corridor Live Flow */}
        <div className="space-y-4 lg:col-span-5">
          {/* Station Master Guidance Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-brand/20 bg-brand-soft">
                <Image
                  src="/aarav-namaste.jpg"
                  alt="Aarav · Tatkal Copilot"
                  fill
                  className="object-cover"
                />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-brand-ink">
                    Aarav
                  </h3>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-ink-soft">
                  Tatkal Copilot
                </p>
              </div>
            </div>

            {/* Speech bubble */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4 text-xs sm:text-[0.82rem] leading-relaxed text-brand-ink font-medium">
              <span className="text-base text-brand mr-1">“</span>
              Agar primary train mein seat nahi mili, toh 1 second ke andar backup train book ho jayegi. Aap bilkul chinta mat kijiye!
              <span className="text-base text-brand ml-1">”</span>
            </div>

            <div className="flex items-center gap-1.5 border-t border-line/60 pt-3 text-[0.72rem] text-emerald-600 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Zero double-charging guarantee on failover</span>
            </div>
          </div>

          {/* Parallel Rail Corridor Live Flow */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-ink uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span>Parallel Rail Corridor</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-600">
                Live Flow
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[0.75rem]">
                  <span className="font-bold text-brand-ink">#{primaryNumber} Primary ({fromCode} → {toCode})</span>
                  <span className="text-emerald-600 font-bold">Priority Corridor</span>
                </div>
                <div className="h-2 w-full rounded-full bg-line-strong overflow-hidden">
                  <div className="h-full w-4/5 bg-brand rounded-full" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[0.75rem]">
                  <span className="font-bold text-brand-ink">#{backupNumber} Failover ({fromCode} → NZM)</span>
                  <span className="text-amber-600 font-bold">Hot Standby</span>
                </div>
                <div className="h-2 w-full rounded-full bg-line-strong overflow-hidden">
                  <div className="h-full w-2/3 bg-amber-500 rounded-full" />
                </div>
              </div>
            </div>

            <div className="border-t border-line/60 pt-3 text-[0.72rem] text-ink-soft flex justify-between font-mono">
              <span>Origin: {fromCode}</span>
              <span>»</span>
              <span>Dest: {toCode}</span>
            </div>

            {/* Corridor Execution Metrics */}
            <div className="rounded-xl border border-line/60 bg-surface-muted/40 p-3 space-y-2 text-xs">
              <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-faint">
                CORRIDOR EXECUTION METRICS
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-base font-bold text-danger font-mono">2m 14s</div>
                  <div className="text-[0.68rem] text-ink-soft">Average Human Tatkal Run-Out</div>
                </div>
                <div>
                  <div className="text-base font-bold text-emerald-600 font-mono">0.82s</div>
                  <div className="text-[0.68rem] text-ink-soft">Automated Pre-Fill</div>
                </div>
              </div>

              <p className="text-[0.7rem] text-ink-soft leading-tight pt-1">
                Your token is ranked <strong>Tier-1 Priority</strong>. Bot will fire pre-authenticated payload at 10:00:00.12 AM.
              </p>
            </div>
          </div>

          {/* IRCTC Multi-Session Ready */}
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-brand-ink">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <span>IRCTC Multi-Session Ready</span>
            </div>
            <p className="text-ink-soft text-[0.74rem] leading-relaxed">
              Captcha tokens pre-cached. Dual payment gateway channels held in reserve so your booking never drops due to bank redirect loops.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
