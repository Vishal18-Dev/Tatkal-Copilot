"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ArrowLeftRight,
  TrainFront,
  ShieldCheck,
  ArrowRight,
  Minus,
  Plus,
  Users,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoalComposer } from "@/features/goal/goal-composer";
import { useJourney } from "@/lib/journey";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { resolveStation } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { TravelClass } from "@/types";

type Preference = "seat" | "fastest" | "fare";

const CLASS_OPTIONS: { v: TravelClass | "any"; label: string }[] = [
  { v: "3A", label: "AC 3 Tier (3A)" },
  { v: "2A", label: "AC 2 Tier (2A)" },
  { v: "1A", label: "AC First (1A)" },
  { v: "SL", label: "Sleeper (SL)" },
  { v: "any", label: "" }, // filled from i18n at render
];

/**
 * Structured journey search (Figma "Plan your journey"). It is a thin
 * presentation layer: on submit it composes a natural-language goal string
 * and hands it to the EXISTING planner via submitGoal — no business logic
 * is duplicated or changed. A "your own words" toggle reveals the original
 * natural-language + speech composer.
 */
export function JourneyForm() {
  const { submitGoal } = useJourney();
  const { travellers } = useStore();
  const { t } = useLang();

  const [mode, setMode] = useState<"form" | "nl">("nl");
  const [from, setFrom] = useState("Mumbai Central");
  const [to, setTo] = useState("New Delhi");
  const [passengers, setPassengers] = useState(
    Math.min(2, Math.max(1, travellers.length || 2))
  );
  const [travelClass, setTravelClass] = useState<TravelClass | "any">("3A");
  const [pref, setPref] = useState<Preference>("seat");

  const fromCode = useMemo(() => resolveStation(from)?.code, [from]);
  const toCode = useMemo(() => resolveStation(to)?.code, [to]);

  const travellerNames = travellers
    .slice(0, passengers)
    .map((p) => p.name.split(" ")[0]);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  function submit() {
    const prefPhrase =
      pref === "fare"
        ? "the cheapest confirmed option"
        : pref === "fastest"
        ? "reach as early as possible"
        : "the best chance of a confirmed seat";
    const classPhrase = travelClass === "any" ? "" : ` in ${travelClass}`;
    const who = passengers > 1 ? "passengers" : "passenger";
    const goal = `from ${from.trim() || "Mumbai"} to ${to.trim() || "Delhi"}, ${passengers} ${who}${classPhrase}, ${prefPhrase}`;
    submitGoal(goal);
  }

  if (mode === "nl") {
    return (
      <div>
        <GoalComposer />
        <div className="mt-5 text-center">
          <button
            onClick={() => setMode("form")}
            className="text-sm font-medium text-brand transition-colors hover:text-brand-strong"
          >
            {t("plan.form.nlHide")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* In-card railway track — origin → destination */}
      <div className="border-b border-line bg-surface-muted/60 px-5 pb-4 pt-4 sm:px-6">
        <div className="mb-2.5 flex items-center justify-between gap-3 text-[0.82rem]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" />
            {from || t("plan.form.origin")}
            {fromCode && <CodeChip code={fromCode} />}
          </span>
          <span className="hidden items-center gap-1.5 text-ink-faint sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-confirm" />
            {t("plan.form.trackClear")}
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand-ink">
            {toCode && <CodeChip code={toCode} />}
            {to || t("plan.form.destination")}
            <span className="h-2.5 w-2.5 rounded-full bg-caution" />
          </span>
        </div>
        <div className="relative h-4" aria-hidden="true">
          <div className="rail-sleepers absolute inset-x-2 top-1/2 h-2 -translate-y-1/2 opacity-70" />
          <div className="absolute inset-x-0 top-[calc(50%-3px)] h-px bg-line-strong" />
          <div className="absolute inset-x-0 top-[calc(50%+3px)] h-px bg-line-strong" />
          <div className="rail-glide absolute left-0 top-1/2 -translate-y-1/2">
            <span className="grid h-5 w-8 place-items-center rounded bg-brand text-white shadow-[var(--shadow-brand)]">
              <TrainFront className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {/* Origin / destination + swap */}
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <StationField
            label={t("plan.form.origin")}
            value={from}
            code={fromCode}
            placeholder={t("plan.form.originPh")}
            onChange={setFrom}
          />
          <button
            type="button"
            onClick={swap}
            aria-label={t("plan.form.swap")}
            className="mx-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-brand transition-all hover:border-brand hover:rotate-180"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <StationField
            label={t("plan.form.destination")}
            value={to}
            code={toCode}
            placeholder={t("plan.form.destPh")}
            onChange={setTo}
          />
        </div>

        {/* Date / passengers / class */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("plan.form.date")} icon={<Calendar className="h-[18px] w-[18px]" />}>
            <span className="text-[0.98rem] font-semibold text-ink">
              {t("plan.form.dateVal")}
            </span>
          </Field>

          <Field label={t("plan.form.passengers")} icon={<Users className="h-[18px] w-[18px]" />}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[0.98rem] font-semibold text-ink">
                {travellerNames.length > 0
                  ? travellerNames.join(" & ")
                  : `${passengers}`}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Stepper
                  aria-label="−"
                  disabled={passengers <= 1}
                  onClick={() => setPassengers((n) => Math.max(1, n - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Stepper>
                <span className="w-4 text-center text-sm font-semibold tabular text-ink">
                  {passengers}
                </span>
                <Stepper
                  aria-label="+"
                  disabled={passengers >= 6}
                  onClick={() => setPassengers((n) => Math.min(6, n + 1))}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Stepper>
              </span>
            </div>
          </Field>

          <Field label={t("plan.form.class")} icon={<TrainFront className="h-[18px] w-[18px]" />}>
            <select
              value={travelClass}
              onChange={(e) => setTravelClass(e.target.value as TravelClass | "any")}
              className="w-full cursor-pointer bg-transparent text-[0.98rem] font-semibold text-ink focus:outline-none"
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.v === "any" ? t("plan.form.classAny") : c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Preference */}
        <div>
          <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">
            {t("plan.form.pref")}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={t("plan.form.pref")}>
            <PrefPill
              active={pref === "seat"}
              onClick={() => setPref("seat")}
              title={t("plan.form.prefSeat")}
              sub={t("plan.form.prefSeatSub")}
            />
            <PrefPill
              active={pref === "fastest"}
              onClick={() => setPref("fastest")}
              title={t("plan.form.prefFast")}
              sub={t("plan.form.prefFastSub")}
            />
            <PrefPill
              active={pref === "fare"}
              onClick={() => setPref("fare")}
              title={t("plan.form.prefFare")}
              sub={t("plan.form.prefFareSub")}
            />
          </div>
        </div>

        {/* Notify + CTA */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <ShieldCheck className="h-4 w-4 text-confirm" />
            {t("plan.form.notify")}
          </span>
          <Button size="lg" onClick={submit} className="group w-full sm:w-auto">
            {t("plan.form.cta")}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>

      <div className="border-t border-line bg-surface-muted/40 px-5 py-3 text-center">
        <button
          onClick={() => setMode("nl")}
          className="text-sm font-medium text-brand transition-colors hover:text-brand-strong"
        >
          {t("plan.form.nlToggle")}
        </button>
      </div>
    </Card>
  );
}

function CodeChip({ code }: { code: string }) {
  return (
    <span className="tabular rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold text-brand">
      {code}
    </span>
  );
}

function StationField({
  label,
  value,
  code,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  code?: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line-strong bg-surface-muted/60 px-3.5 py-2.5 transition-colors focus-within:border-brand focus-within:bg-surface">
      <label className="mb-0.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[0.98rem] font-semibold text-ink placeholder:font-normal placeholder:text-ink-faint focus:outline-none"
        />
        {code && <CodeChip code={code} />}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-line-strong bg-surface-muted/60 px-3.5 py-2.5">
      <label className="mb-0.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </label>
      <div className="flex items-center gap-2 text-brand">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Stepper({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="grid h-6 w-6 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function PrefPill({
  active,
  onClick,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 rounded-[var(--radius)] border p-3 text-left transition-colors",
        active
          ? "border-brand bg-brand-soft/50"
          : "border-line-strong bg-surface hover:border-line-strong hover:bg-surface-muted"
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
          active ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"
        )}
      >
        {active && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[0.92rem] font-semibold leading-snug",
            active ? "text-brand-ink" : "text-ink"
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-soft">{sub}</span>
      </span>
    </button>
  );
}
