"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepShell, Eyebrow } from "@/components/step-shell";
import { TrainRow } from "./train-row";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { explainDeviation } from "@/lib/planner";

export function StrategyScreen() {
  const { plan, chosenOption, chosenOptionId, chooseOption, goTo } = useJourney();
  const { t } = useLang();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!plan || !chosenOption) return null;

  const recommended = plan.options.find((o) => o.id === plan.recommendedId)!;
  const deviation = pendingId ? explainDeviation(plan, pendingId) : null;

  function choose(id: string) {
    if (id === recommended.id || id === chosenOptionId) {
      chooseOption(id);
      return;
    }
    setPendingId(id); // AI advisory before committing to a riskier pick
  }

  return (
    <StepShell wide>
      <Eyebrow>{t("results.eyebrow")}</Eyebrow>
      <h2 className="text-headline">{t("results.title")}</h2>

      {/* Route summary — familiar search context */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span className="font-semibold text-ink">
          {plan.intent.from} → {plan.intent.to}
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-soft">
          <Users className="h-4 w-4 text-ink-faint" />
          {plan.intent.passengers}{" "}
          {plan.intent.passengers > 1 ? t("results.travellers") : t("results.traveller")}
        </span>
        {plan.intent.arrivalDeadline && (
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <Clock className="h-4 w-4 text-ink-faint" />
            {t("results.by")} {plan.intent.arrivalDeadline}
          </span>
        )}
      </div>

      {/* Agent intro — the copilot voice */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-soft/50 px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-[0.95rem] leading-relaxed text-ink">
          {plan.narrative.whyRecommended}
        </p>
      </div>

      {/* Column header (desktop) */}
      <div className="mt-6 hidden px-5 text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint sm:flex sm:items-center sm:gap-4">
        <span className="flex-1">{t("results.colTrain")}</span>
        <span className="w-52 text-center">{t("results.colTiming")}</span>
        <span className="w-24 text-right">{t("results.colFare")}</span>
        <span className="w-28 text-center">{t("results.colConfidence")}</span>
        <span className="w-32" />
      </div>

      {/* Results list */}
      <div className="mt-2 space-y-3">
        {plan.options.map((o, i) => (
          <TrainRow
            key={o.id}
            option={o}
            chosen={chosenOptionId === o.id}
            onChoose={() => choose(o.id)}
            index={i}
          />
        ))}
      </div>

      {/* Sticky-feel footer */}
      <div className="mt-8 flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide text-ink-faint">
              {t("results.goingWith")}
            </div>
            <div className="text-[0.98rem] font-semibold text-ink">
              {chosenOption.title} · {t(`level.${chosenOption.level}`)}
              {chosenOptionId !== recommended.id && (
                <span className="ml-2 rounded-full bg-caution-soft px-2 py-0.5 text-[0.7rem] font-medium text-caution">
                  {t("results.notOurPick")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {chosenOptionId !== recommended.id && (
            <Button variant="ghost" size="md" onClick={() => chooseOption(recommended.id)}>
              <RotateCcw className="h-4 w-4" />
              {t("results.chooseRec")}
            </Button>
          )}
          <Button size="lg" onClick={() => goTo("vault")} className="group">
            {t("results.continue")}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>

      {/* AI advisory when deviating */}
      <AnimatePresence>
        {deviation && pendingId && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setPendingId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-7 shadow-[var(--shadow-lift)]"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center gap-2 text-caution">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-caution-soft">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("results.advisory")}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-semibold text-ink">{deviation.title}</h3>
              <p className="mt-2.5 text-[0.98rem] leading-relaxed text-ink-soft">
                {deviation.body}
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    chooseOption(pendingId);
                    setPendingId(null);
                  }}
                >
                  {t("results.continueAnyway")}
                </Button>
                <Button size="md" onClick={() => setPendingId(null)}>
                  <ShieldCheck className="h-4 w-4" />
                  {t("results.chooseRec")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </StepShell>
  );
}
