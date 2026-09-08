"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Radio,
  Mic,
  Lock,
  Clock,
  CheckCircle2,
  Train,
  Check,
} from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PlanEmptyState } from "./empty-states/plan-empty-state";

import { getRailwayMetadata } from "@/lib/geo/railway-metadata";

export function Step1PlanScreen() {
  const { plan, planning, submitGoal, goTo } = useJourney();
  const { t } = useLang();
  const [inputGoal, setInputGoal] = useState("");
  const [selectedClassOverride, setSelectedClassOverride] = useState<string | null>(null);

  if (planning) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand animate-pulse">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-ink">Analyzing Tatkal Quotas & Optimal Corridors...</h2>
        <p className="text-xs text-ink-soft leading-relaxed max-w-md mx-auto">
          Extracting journey constraints, evaluating historical IRCTC Tatkal exhaustion speeds, and staging 400ms failover backups.
        </p>
      </div>
    );
  }

  if (!plan) {
    return <PlanEmptyState />;
  }

  const fromName = plan.intent.from;
  const fromCode = plan.intent.fromCode;
  const toName = plan.intent.to;
  const toCode = plan.intent.toCode;
  const dateVal = plan.intent.date || "Tomorrow";
  const passengers = plan.intent.passengers;
  const preferredClass = plan.intent.preferredClass || "3A";
  const selectedClass = selectedClassOverride || (preferredClass === "any" ? "3A" : preferredClass);
  const setSelectedClass = setSelectedClassOverride;

  const fromMeta = getRailwayMetadata(fromCode);
  const toMeta = getRailwayMetadata(toCode);

  const quoteText =
    plan.intent.restated ||
    `Need to go from ${fromName} to ${toName} tomorrow morning${passengers ? `, ${passengers} travellers` : ""}.`;

  return (
    <div className="space-y-6">
      {/* Top Banner Tag & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>STEP 01 OF 05 · INTENT & CONTEXT CAPTURED · VOICE DECODED</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[0.75rem] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            <span>LATENCY: 142ms</span>
          </span>
          <span>·</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            IRCTC CORRIDOR READY
          </span>
        </div>
      </div>

      {/* Main Headline */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl lg:text-[2.2rem] leading-tight">
          “Bilkul, Samajh gaya!{" "}
          <span className="text-brand">
            {fromName} se {toName} kal subah.
          </span>
          ”
        </h1>
        <p className="mt-1.5 text-sm sm:text-base text-ink-soft">
          Context successfully extracted from voice audio. Review your mission brief below before proceeding to coach selection.
        </p>
      </div>

      {/* Two Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column (7 Cols): Spoken Input & Parameters Grid */}
        <div className="space-y-5 lg:col-span-7">
          {/* Spoken Input Stream Card */}
          <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-ink-soft">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Radio className="h-3.5 w-3.5" />
                </span>
                <span className="text-[0.72rem] uppercase tracking-wider font-bold text-ink-faint">
                  SPOKEN INPUT STREAM
                </span>
                <span>·</span>
                <span className="text-ink">Hindi · English Hinglish Voice Model v4.2</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Voice input verified
              </span>
            </div>

            <div className="rounded-xl border border-line/60 bg-surface-muted/60 p-3.5 text-sm sm:text-base italic text-brand-ink font-medium leading-relaxed">
              “{quoteText}”
            </div>
          </div>

          {/* Extracted Journey Parameters Grid */}
          <div className="space-y-2.5">
            <div className="text-[0.72rem] font-bold uppercase tracking-wider text-ink-faint">
              EXTRACTED JOURNEY PARAMETERS
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Origin */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <span className="h-2 w-2 rounded-full border border-brand bg-white" />
                  <span>ORIGIN STATION</span>
                </div>
                <div className="text-base font-bold text-brand-ink">{fromName}</div>
                <div className="font-mono text-xs text-ink-soft">
                  <span className="font-bold text-brand">{fromCode}</span> · {fromMeta.zoneName}
                </div>
              </div>

              {/* Destination */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <span className="h-2 w-2 rounded-full bg-danger" />
                  <span>DESTINATION STATION</span>
                </div>
                <div className="text-base font-bold text-brand-ink">{toName}</div>
                <div className="font-mono text-xs text-ink-soft">
                  <span className="font-bold text-brand">{toCode}</span> · {toMeta.zoneName}
                </div>
              </div>

              {/* Date */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <Clock className="h-3 w-3 text-ink-faint" />
                  <span>DEPARTURE DATE</span>
                </div>
                <div className="text-base font-bold text-brand-ink">{dateVal}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  AC Tatkal Opens Today 10:00 AM
                </div>
              </div>

              {/* Passengers */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <Train className="h-3 w-3 text-ink-faint" />
                  <span>PASSENGERS</span>
                </div>
                <div className="text-base font-bold text-brand-ink">
                  {passengers !== undefined ? `${passengers} Adult${passengers > 1 ? "s" : ""}` : "Required"}
                </div>
                <div className="text-xs text-ink-soft">
                  {passengers !== undefined ? "Business context tagged" : "Specify before booking"}
                </div>
              </div>

              {/* Arrival Constraint */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <Clock className="h-3 w-3 text-ink-faint" />
                  <span>ARRIVAL CONSTRAINT</span>
                </div>
                <div className="text-base font-bold text-brand-ink">Before 09:00 AM</div>
                <div className="text-xs text-ink-soft">Prioritizes morning meetings</div>
              </div>

              {/* Preferred Classes */}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm space-y-1">
                <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
                  <ShieldCheck className="h-3 w-3 text-ink-faint" />
                  <span>PREFERRED CLASSES</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedClass("3A")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      selectedClass === "3A"
                        ? "bg-brand text-white"
                        : "bg-surface-muted text-ink-soft hover:bg-surface-muted/80"
                    )}
                  >
                    3A (Third AC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedClass("2A")}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      selectedClass === "2A"
                        ? "bg-brand text-white"
                        : "bg-surface-muted text-ink-soft hover:bg-surface-muted/80"
                    )}
                  >
                    2A (Second AC)
                  </button>
                </div>
                <div className="text-xs text-ink-soft">Tatkal quota prioritized</div>
              </div>
            </div>
          </div>

          {/* IRCTC Live Corridor Sync Complete Notice */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-brand-ink">
                IRCTC Live Corridor Sync Complete
              </span>
              <span className="text-ink-soft">
                · 14 direct trains analyzed · 2 high-probability Tatkal options identified
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-700 dark:text-emerald-300">
              CORRIDOR CLEAR
            </span>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Advancing...</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-muted"
              >
                <Mic className="h-3.5 w-3.5 text-brand" />
                <span>Bolkar Sudhaarein</span>
              </button>

              <button
                type="button"
                onClick={() => goTo("options")}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-brand-strong cursor-pointer"
              >
                <span>Proceed to Train Strategy</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Station Master & Corridor Architecture */}
        <div className="space-y-4 lg:col-span-5">
          {/* Station Master Copilot Box */}
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
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[0.65rem] font-bold text-emerald-600">
                    Online
                  </span>
                </div>
                <p className="text-xs text-ink-soft">
                  Tatkal Copilot
                </p>
              </div>
            </div>

            {/* Speech bubble */}
            <div className="rounded-xl border border-brand/20 bg-brand-soft/40 p-4 text-xs sm:text-[0.82rem] leading-relaxed text-brand-ink font-medium">
              <span className="text-base text-brand mr-1">“</span>
              <strong className="text-brand">Sun liya maine!</strong> {fromName} se {toName} ke liye sabse reliable Rajdhani aur uski 15-minute backup train select kar li hai. Dono subah 08:30 tak pahuncha dengi. Chaliye options dekhte hain!
            </div>

            <div className="flex items-center justify-between border-t border-line/60 pt-3 text-[0.72rem] text-ink-faint">
              <span className="flex items-center gap-1 text-ink-soft">
                <Lock className="h-3 w-3 text-emerald-500" />
                <span>Token Synchronized</span>
              </span>
              <span className="font-mono font-bold text-brand-ink tracking-wider">
                IRCTC-SYNC-9842
              </span>
            </div>
          </div>

          {/* Corridor Architecture */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-ink uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span>Corridor Architecture</span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-600">
                TRACK CLEAR
              </span>
            </div>

            {/* Route Timeline */}
            <div className="space-y-3 py-1">
              <div className="relative flex items-center justify-between text-center">
                {/* Connecting track line */}
                <div className="absolute left-4 right-4 top-3 h-0.5 bg-brand-ink/40 z-0" />

                {/* Node 1 */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className="h-6 w-6 rounded-full bg-brand text-[0.65rem] font-bold text-white flex items-center justify-center shadow-xs">
                    <Train className="h-3 w-3" />
                  </span>
                  <span className="mt-1 font-mono text-[0.72rem] font-bold text-brand-ink">
                    {fromCode}
                  </span>
                  <span className="text-[0.65rem] text-ink-soft">16:55</span>
                  <span className="text-[0.6rem] font-bold text-brand">Origin</span>
                </div>

                {/* Node 2 */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className="h-4 w-4 rounded-full bg-line-strong border-2 border-surface" />
                  <span className="mt-2 font-mono text-[0.72rem] font-semibold text-ink-soft">
                    BRC
                  </span>
                  <span className="text-[0.65rem] text-ink-faint">21:50</span>
                  <span className="text-[0.6rem] text-ink-faint">Vadodara</span>
                </div>

                {/* Node 3 */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className="h-4 w-4 rounded-full bg-line-strong border-2 border-surface" />
                  <span className="mt-2 font-mono text-[0.72rem] font-semibold text-ink-soft">
                    KOTA
                  </span>
                  <span className="text-[0.65rem] text-ink-faint">03:15</span>
                  <span className="text-[0.6rem] text-ink-faint">Kota Jn</span>
                </div>

                {/* Node 4 */}
                <div className="relative z-10 flex flex-col items-center">
                  <span className="h-6 w-6 rounded-full bg-brand text-[0.65rem] font-bold text-white flex items-center justify-center shadow-xs">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="mt-1 font-mono text-[0.72rem] font-bold text-brand-ink">
                    {toCode}
                  </span>
                  <span className="text-[0.65rem] text-ink-soft">08:35</span>
                  <span className="text-[0.6rem] font-bold text-danger">Target</span>
                </div>
              </div>
            </div>

            {/* Atomic Clock Banner */}
            <div className="flex items-center justify-between rounded-xl bg-surface-muted/60 p-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <Clock className="h-3.5 w-3.5 text-brand" />
                <span>Atomic Master Clock:</span>
                <strong className="font-mono text-brand-ink">09:42:18 IST</strong>
              </span>
              <span className="font-mono text-[0.68rem] text-confirm font-bold">
                DRIFT ±2ms
              </span>
            </div>
          </div>

          {/* 2 High-Probability Options Card */}
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-caution-soft text-caution">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-bold text-ink">2 High-Probability Options</div>
                <div className="text-xs text-ink-soft">
                  12951 Tejas Rajdhani · 12953 AK Tejas
                </div>
              </div>
            </div>

            <span className="rounded-lg bg-confirm px-2.5 py-1 text-xs font-bold text-white">
              READY
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
