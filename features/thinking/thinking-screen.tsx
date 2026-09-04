"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, TrainFront } from "lucide-react";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";

// Calm, human progress — routes → trains → options. The planning call and
// its fallback chain are untouched; this is only the waiting experience.
const STEP_KEYS = [
  "thinking.step1",
  "thinking.step2",
  "thinking.step3",
  "thinking.step4",
];

const REVEAL_MS = 950;

export function ThinkingScreen() {
  const { goTo, planning, plan } = useJourney();
  const { t } = useLang();
  const [revealed, setRevealed] = useState(0);

  // Reveal reasoning steps one at a time.
  useEffect(() => {
    if (revealed >= STEP_KEYS.length) return;
    const id = setTimeout(() => setRevealed((r) => r + 1), REVEAL_MS);
    return () => clearTimeout(id);
  }, [revealed]);

  // Advance only when the theater is done AND the plan has landed.
  useEffect(() => {
    if (revealed >= STEP_KEYS.length && !planning && plan) {
      const id = setTimeout(() => goTo("strategy"), 650);
      return () => clearTimeout(id);
    }
  }, [revealed, planning, plan, goTo]);

  const allRevealed = revealed >= STEP_KEYS.length;

  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      {/* Railway motif — a train easing along the line while we work. */}
      <div className="relative mb-9 h-10 w-full max-w-xs" aria-hidden="true">
        <div className="rail-sleepers absolute inset-x-4 top-1/2 h-2.5 -translate-y-1/2 opacity-70" />
        <div className="absolute inset-x-0 top-[calc(50%-4px)] h-px bg-line-strong" />
        <div className="absolute inset-x-0 top-[calc(50%+4px)] h-px bg-line-strong" />
        <span className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand ring-4 ring-canvas" />
        <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-caution ring-4 ring-canvas" />
        <div className="rail-glide absolute left-0 top-1/2 -translate-y-1/2">
          <span className="grid h-7 w-10 place-items-center rounded-md bg-brand text-white shadow-[var(--shadow-brand)]">
            <TrainFront className="h-4 w-4" />
          </span>
        </div>
      </div>

      <h2 className="text-title font-semibold text-brand-ink">
        {t("thinking.title")}
      </h2>
      <p className="mt-2 text-ink-soft">{t("thinking.subtitle")}</p>

      <ul className="mt-9 w-full space-y-2.5 text-left">
        {STEP_KEYS.map((key, i) => {
          const isDone = i < revealed;
          const isActive = i === revealed;
          const showSpinner =
            isActive || (i === STEP_KEYS.length - 1 && allRevealed && planning);
          if (!isDone && !isActive) return null;
          return (
            <motion.li
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-line bg-surface/80 px-4 py-3 backdrop-blur"
            >
              <span
                className={
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full " +
                  (isDone && !showSpinner
                    ? "bg-confirm text-white"
                    : "bg-brand-soft text-brand")
                }
              >
                <AnimatePresence mode="wait">
                  {showSpinner ? (
                    <motion.span
                      key="spin"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Loader2 className="h-3.5 w-3.5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span
                className={
                  "text-[0.98rem] " +
                  (isDone && !showSpinner ? "text-ink" : "text-ink-soft")
                }
              >
                {t(key)}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
