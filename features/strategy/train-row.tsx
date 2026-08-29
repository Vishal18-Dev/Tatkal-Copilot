"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Check,
  Scale,
  AlertTriangle,
  Info,
  MapPin,
} from "lucide-react";
import { cn, formatFare } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { ConfidenceLevel, OptionTag, StrategyOption } from "@/types";

const TAG_META: Record<
  OptionTag,
  { emoji: string; cls: string }
> = {
  recommended: { emoji: "⭐", cls: "bg-confirm-soft text-confirm" },
  highest: { emoji: "🟢", cls: "bg-confirm-soft text-confirm" },
  cheapest: { emoji: "💰", cls: "bg-brand-soft text-brand-ink" },
  fastest: { emoji: "⚡", cls: "bg-brand-soft text-brand-ink" },
  popular: { emoji: "🔴", cls: "bg-danger-soft text-danger" },
};

const LEVEL_CLS: Record<ConfidenceLevel, string> = {
  "Very High": "bg-confirm-soft text-confirm",
  High: "bg-confirm-soft text-confirm",
  Medium: "bg-caution-soft text-caution",
  Low: "bg-danger-soft text-danger",
};

export function TrainRow({
  option,
  chosen,
  onChoose,
  index,
}: {
  option: StrategyOption;
  chosen: boolean;
  onChoose: () => void;
  index: number;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const tag = TAG_META[option.tag];
  const isRec = option.recommended;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface transition-colors",
        chosen
          ? "border-brand shadow-[var(--shadow-card)]"
          : isRec
          ? "border-confirm/40"
          : "border-line hover:border-line-strong",
        isRec && "border-l-[3px] border-l-confirm"
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        {/* Train identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold",
                tag.cls
              )}
            >
              <span aria-hidden>{tag.emoji}</span>
              {option.tagLabel}
            </span>
            {option.betterBoarding && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">
                <MapPin className="h-3 w-3" /> {t("results.viaBoarding")}{" "}
                {option.boardingStationName}
              </span>
            )}
          </div>
          <h4 className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
            {option.title}
          </h4>
          <p className="text-xs text-ink-faint">
            {option.subtitle} · {option.travelClass}
          </p>
        </div>

        {/* Timing */}
        <div className="flex items-center gap-3 sm:w-52 sm:justify-center">
          <div className="text-center">
            <div className="tabular text-base font-semibold text-ink">
              {option.departureDisplay}
            </div>
            <div className="text-[0.7rem] text-ink-faint">{t("results.depart")}</div>
          </div>
          <div className="flex flex-col items-center text-ink-faint">
            <span className="text-[0.68rem]">{option.durationDisplay}</span>
            <span className="my-0.5 h-px w-10 bg-line-strong" />
          </div>
          <div className="text-center">
            <div className="tabular text-base font-semibold text-ink">
              {option.arrivalDisplay.split(" · ")[0]}
            </div>
            <div className="text-[0.7rem] text-ink-faint">
              {option.arrivalDisplay.split(" · ")[1] ?? t("results.arrive")}
            </div>
          </div>
        </div>

        {/* Fare */}
        <div className="sm:w-24 sm:text-right">
          <div className="tabular text-base font-semibold text-ink">
            {formatFare(option.fare)}
          </div>
          <div className="text-[0.7rem] text-ink-faint">{t("results.est")}</div>
        </div>

        {/* Confidence */}
        <div className="sm:w-28 sm:text-center">
          <span
            className={cn(
              "inline-block rounded-full px-2.5 py-1 text-[0.75rem] font-semibold",
              LEVEL_CLS[option.level]
            )}
          >
            {t(`level.${option.level}`)}
          </span>
          <div className="mt-0.5 text-[0.65rem] text-ink-faint">
            {t("results.confidence")}
          </div>
        </div>

        {/* Choose */}
        <div className="flex items-center gap-2 sm:w-32 sm:justify-end">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onChoose}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
              chosen
                ? "bg-confirm text-white"
                : "bg-brand text-white hover:bg-[#4338ca]"
            )}
          >
            {chosen ? (
              <>
                <Check className="h-4 w-4" strokeWidth={3} /> {t("results.chosen")}
              </>
            ) : (
              t("results.choose")
            )}
          </motion.button>
        </div>
      </div>

      {/* Why? toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 border-t border-line px-5 py-2.5 text-left text-[0.82rem] font-medium text-brand transition-colors hover:bg-brand-soft/40"
        aria-expanded={open}
      >
        <Info className="h-3.5 w-3.5" />
        {isRec ? t("results.whyRec") : t("results.why")}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-surface-muted/40"
          >
            <div className="space-y-3 px-5 py-4">
              <p className="text-[0.95rem] leading-relaxed text-ink">
                {option.why}
              </p>
              {(option.tradeoffs.length > 0 || option.risks.length > 0) && (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {option.tradeoffs.map((tr) => (
                    <span key={tr} className="flex items-start gap-1.5 text-xs text-ink-soft">
                      <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                      {tr}
                    </span>
                  ))}
                  {option.risks.map((r) => (
                    <span key={r} className="flex items-start gap-1.5 text-xs text-ink-soft">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution" />
                      {r}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[0.7rem] italic text-ink-faint">
                {t("results.simNote")}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
