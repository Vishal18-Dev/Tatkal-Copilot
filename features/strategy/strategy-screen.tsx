"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepShell } from "@/components/step-shell";
import { OptionCard } from "./option-card";
import { TrainRow } from "./train-row";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { explainDeviation } from "@/lib/planner";
import { formatFare } from "@/lib/utils";

export function StrategyScreen() {
  const { plan, chosenOption, chosenOptionId, chooseOption, goTo } = useJourney();
  const { t } = useLang();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  if (!plan || !chosenOption) return null;

  const recommended = plan.options.find((o) => o.id === plan.recommendedId)!;
  const deviation = pendingId ? explainDeviation(plan, pendingId) : null;

  const hero = plan.options.slice(0, 2);
  const rest = plan.options.slice(2);

  function choose(id: string) {
    if (id === recommended.id || id === chosenOptionId) {
      chooseOption(id);
      return;
    }
    setPendingId(id); // AI advisory before committing to a riskier pick
  }

  return (
    <StepShell wide>
      {/* Route breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.8rem]">
        <span className="font-semibold text-brand-ink">{plan.intent.from}</span>
        <ArrowRight className="h-3.5 w-3.5 text-ink-faint" />
        <span className="font-semibold text-brand-ink">{plan.intent.to}</span>
        <span className="text-line-strong">·</span>
        <span className="text-ink-soft">{t("plan.form.dateVal")}</span>
        <span className="text-line-strong">·</span>
        <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-medium text-ink">
          {plan.intent.passengers}{" "}
          {plan.intent.passengers > 1 ? t("results.travellers") : t("results.traveller")}
          {plan.intent.preferredClass !== "any" ? ` · ${plan.intent.preferredClass}` : ""}
        </span>
      </div>

      {/* Heading + Tatkal window reminder */}
      <div className="mt-3 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-headline text-brand-ink">{t("results.title")}</h1>
          <p className="mt-1 max-w-lg text-[0.98rem] text-ink-soft">
            {t("results.subtitlePrefix")} {plan.options.length} {t("results.subtitleSuffix")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-[var(--radius)] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Clock className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="text-[0.9rem] font-semibold text-brand-ink">
              {recommended.tatkalOpensAt} {t("results.windowLabel")}
            </div>
            <div className="text-xs text-ink-soft">{t("results.windowNote")}</div>
          </div>
        </div>
      </div>

      {/* Agent intro — the copilot voice */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-soft/50 px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-[0.95rem] leading-relaxed text-ink">{plan.narrative.whyRecommended}</p>
      </div>

      {/* Hero cards — top options */}
      <div className={`mt-6 grid gap-5 ${hero.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {hero.map((o, i) => (
          <OptionCard
            key={o.id}
            option={o}
            chosen={chosenOptionId === o.id}
            onChoose={() => choose(o.id)}
            index={i}
          />
        ))}
      </div>

      {/* More trains, tucked away */}
      {rest.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowMore((s) => !s)}
            className="mx-auto flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[0.9rem] font-semibold text-brand-ink shadow-sm transition-colors hover:border-line-strong"
          >
            {showMore
              ? t("results.hideOthers")
              : `${t("results.showOthersPrefix")} ${rest.length} ${t("results.showOthersSuffix")}`}
            <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {showMore && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  {rest.map((o, i) => (
                    <TrainRow
                      key={o.id}
                      option={o}
                      chosen={chosenOptionId === o.id}
                      onChoose={() => choose(o.id)}
                      index={i}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Sticky-feel footer summary */}
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
            <div className="tabular mt-0.5 text-[0.85rem] text-ink-soft">
              {formatFare(chosenOption.fare * plan.intent.passengers)} · {plan.intent.passengers}{" "}
              {plan.intent.passengers > 1 ? t("results.travellers") : t("results.traveller")}
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
