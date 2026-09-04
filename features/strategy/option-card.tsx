"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Scale, AlertTriangle, ShieldCheck, MapPin } from "lucide-react";
import { cn, formatFare } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { ConfidenceLevel, OptionTag, StrategyOption } from "@/types";

const TAG_META: Record<OptionTag, { emoji: string; cls: string }> = {
  recommended: { emoji: "⭐", cls: "bg-confirm-soft text-confirm" },
  highest: { emoji: "🟢", cls: "bg-confirm-soft text-confirm" },
  cheapest: { emoji: "💰", cls: "bg-brand-soft text-brand-ink" },
  fastest: { emoji: "⚡", cls: "bg-brand-soft text-brand-ink" },
  popular: { emoji: "🔴", cls: "bg-caution-soft text-caution" },
};

const LEVEL_CLS: Record<ConfidenceLevel, string> = {
  "Very High": "bg-confirm-soft text-confirm",
  High: "bg-confirm-soft text-confirm",
  Medium: "bg-caution-soft text-caution",
  Low: "bg-danger-soft text-danger",
};

/** Large hero-style option card — used for the top 1-2 picks. */
export function OptionCard({
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex h-full flex-col rounded-[var(--radius-lg)] border-2 bg-surface p-6 shadow-[var(--shadow-card)] transition-colors",
        chosen
          ? "border-brand"
          : isRec
          ? "border-confirm/30"
          : "border-line hover:border-line-strong"
      )}
    >
      {/* Badge row */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8rem] font-semibold",
            tag.cls
          )}
        >
          <span aria-hidden>{tag.emoji}</span>
          {option.tagLabel}
        </span>
        <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-mono text-[0.85rem] text-ink-soft">
          {option.subtitle}
        </span>
      </div>

      {/* Identity */}
      <h3 className="mt-3 text-[1.7rem] font-bold leading-tight tracking-tight text-brand-ink">
        {option.title}
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        {option.why.split(".")[0]}.
      </p>
      {option.betterBoarding && (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">
          <MapPin className="h-3 w-3" /> {t("results.viaBoarding")} {option.boardingStationName}
        </span>
      )}

      {/* Timetable strip */}
      <div className="mt-4 flex items-center justify-between rounded-[var(--radius)] bg-surface-muted p-4">
        <div>
          <div className="tabular text-2xl font-bold text-brand-ink">
            {option.departureDisplay}
          </div>
          <div className="text-[0.7rem] text-ink-faint">{t("results.depart")}</div>
        </div>
        <div className="flex flex-1 flex-col items-center px-3 text-center">
          <span className="text-xs font-semibold text-ink-soft">{option.durationDisplay}</span>
          <span className="my-1 h-px w-full bg-line-strong" />
          <span className="text-[0.65rem] uppercase tracking-wide text-ink-faint">
            {t("results.confidence")}: {t(`level.${option.level}`)}
          </span>
        </div>
        <div className="text-right">
          <div className="tabular text-2xl font-bold text-brand-ink">
            {option.arrivalDisplay.split(" · ")[0]}
          </div>
          <div className="text-[0.7rem] text-ink-faint">
            {option.arrivalDisplay.split(" · ")[1] ?? t("results.arrive")}
          </div>
        </div>
      </div>

      {/* Why callout */}
      <div
        className={cn(
          "mt-4 flex items-start gap-3 rounded-[var(--radius)] border p-4",
          isRec ? "border-confirm/20 bg-confirm-soft/40" : "border-caution/20 bg-caution-soft/40"
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
            isRec ? "bg-confirm text-white" : "bg-caution text-white"
          )}
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[0.98rem] font-semibold text-ink">
            {t(`level.${option.level}`)} {t("results.confidence")}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{option.why}</p>
        </div>
      </div>

      {(option.tradeoffs.length > 0 || option.risks.length > 0) && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-3 flex w-fit items-center gap-1 text-[0.82rem] font-medium text-brand transition-colors hover:text-brand-strong"
            aria-expanded={open}
          >
            {t("results.details")}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid gap-1.5 pt-2 sm:grid-cols-2">
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
                <p className="mt-2 text-[0.7rem] italic text-ink-faint">{t("results.simNote")}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Fare + choose */}
      <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-4">
        <div>
          <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-faint">
            {t("results.est")}
          </div>
          <div className="tabular text-2xl font-bold text-brand-ink">{formatFare(option.fare)}</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onChoose}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-colors",
            chosen
              ? "bg-confirm text-white"
              : "bg-brand text-white hover:bg-brand-strong"
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
    </motion.div>
  );
}
