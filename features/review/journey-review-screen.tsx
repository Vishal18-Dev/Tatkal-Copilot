"use client";

import {
  MapPin,
  TrainFront,
  Users,
  Split,
  Sparkles,
  ArrowRight,
  Clock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StepShell, Eyebrow } from "@/components/step-shell";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { formatFare } from "@/lib/utils";

export function JourneyReviewScreen() {
  const { plan, chosenOption, recoveryOption, selectedPassengers, goTo } =
    useJourney();
  const { t } = useLang();
  if (!plan || !chosenOption) return null;

  const total = chosenOption.fare * Math.max(1, selectedPassengers.length);

  return (
    <StepShell>
      <Eyebrow>{t("review.eyebrow")}</Eyebrow>
      <h2 className="text-headline">{t("review.title")}</h2>
      <p className="mt-3 text-lg text-ink-soft">{t("review.subtitle")}</p>

      {/* Journey + train */}
      <Card className="mt-7 p-6">
        <SectionHead icon={<TrainFront className="h-5 w-5 text-brand" />} title={t("review.train")}>
          <button
            onClick={() => goTo("strategy")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("review.changeTrain")}
          </button>
        </SectionHead>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-ink">{chosenOption.title}</div>
            <div className="text-sm text-ink-faint">
              {plan.intent.from} → {plan.intent.to} · {chosenOption.travelClass}
            </div>
          </div>
          <span className="rounded-full bg-confirm-soft px-3 py-1 text-sm font-semibold text-confirm">
            {t(`level.${chosenOption.level}`)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact icon={<MapPin className="h-4 w-4" />} label={t("review.boarding")}>
            {chosenOption.boardingStationName}
          </Fact>
          <Fact icon={<Clock className="h-4 w-4" />} label={t("review.arrival")}>
            {chosenOption.arrivalDisplay}
          </Fact>
          <Fact icon={<TrainFront className="h-4 w-4" />} label={t("review.departs")}>
            {chosenOption.departureDisplay}
          </Fact>
        </div>
      </Card>

      {/* Passengers */}
      <Card className="mt-4 p-6">
        <SectionHead icon={<Users className="h-5 w-5 text-brand" />} title={t("review.passengers")}>
          <button
            onClick={() => goTo("vault")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("review.editPassengers")}
          </button>
        </SectionHead>
        <div className="mt-1 divide-y divide-line">
          {selectedPassengers.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2.5">
              <span className="text-[0.98rem] font-medium text-ink">
                {p.name}
                {p.isSenior && (
                  <span className="ml-2 rounded-full bg-caution-soft px-2 py-0.5 text-[0.68rem] font-semibold text-caution">
                    {t("vault.senior")}
                  </span>
                )}
              </span>
              <span className="text-sm text-ink-faint">
                {p.age} · {p.gender} · {p.berthPreference} · {p.mealPreference}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup + why */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {recoveryOption && (
          <Card className="border-caution/30 bg-caution-soft/30 p-5">
            <div className="flex items-center gap-2 text-caution">
              <Split className="h-5 w-5" />
              <h4 className="text-sm font-semibold uppercase tracking-wide">
                {t("review.backup")}
              </h4>
            </div>
            <p className="mt-2 text-[0.98rem] font-semibold text-ink">
              {recoveryOption.title}
            </p>
            <p className="text-sm text-ink-soft">{t("review.backupNote")}</p>
          </Card>
        )}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-brand">
            <Sparkles className="h-5 w-5" />
            <h4 className="text-sm font-semibold uppercase tracking-wide">
              {t("review.why")}
            </h4>
          </div>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
            {plan.narrative.whyRecommended}
          </p>
        </Card>
      </div>

      {/* Fare + continue */}
      <div className="mt-6 flex items-center justify-between rounded-[var(--radius-lg)] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-faint">
            {t("review.estFare")}
          </div>
          <div className="tabular text-xl font-semibold text-ink">
            {formatFare(total)}
          </div>
        </div>
        <Button size="lg" onClick={() => goTo("authorize")} className="group">
          {t("review.continue")}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </StepShell>
  );
}

function SectionHead({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-ink-faint">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[0.95rem] font-semibold text-ink">{children}</div>
    </div>
  );
}
