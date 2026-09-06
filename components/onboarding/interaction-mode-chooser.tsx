"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Eye, Mic, Accessibility } from "lucide-react";
import { useInteractionMode, type InteractionMode } from "@/lib/interaction-mode";
import { useLang } from "@/lib/i18n";

/* The accessibility entry point (spec §19/§20). Shown once, the first time a
   signed-in citizen reaches the app: "How would you like to use Tatkal
   Copilot?" — three equal ways in, none of them a lesser product. Changeable
   anytime from Settings. */

const OPTIONS: {
  mode: InteractionMode;
  icon: typeof Eye;
  titleKey: string;
  descKey: string;
}[] = [
  { mode: "visual", icon: Eye, titleKey: "a11y.visual", descKey: "a11y.visualDesc" },
  { mode: "voice", icon: Mic, titleKey: "a11y.voice", descKey: "a11y.voiceDesc" },
  { mode: "accessible", icon: Accessibility, titleKey: "a11y.accessible", descKey: "a11y.accessibleDesc" },
];

export function InteractionModeChooser() {
  const { chosen, setMode, dismissChooser } = useInteractionMode();
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (chosen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissChooser();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, dismissChooser]);

  if (!mounted || chosen) return null;

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-chooser-title"
      aria-describedby="a11y-chooser-sub"
      className="fixed inset-0 z-[70] grid place-items-center bg-scrim p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-2xl rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8"
        initial={{ y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h2 id="a11y-chooser-title" className="text-balance text-center text-2xl font-semibold text-ink">
          {t("a11y.chooserTitle")}
        </h2>
        <p id="a11y-chooser-sub" className="mx-auto mt-2 max-w-md text-center text-ink-soft">
          {t("a11y.chooserSub")}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o, i) => (
            <button
              key={o.mode}
              autoFocus={i === 0}
              onClick={() => setMode(o.mode)}
              className="group flex flex-col items-center gap-3 rounded-[var(--radius)] border-2 border-line-strong bg-surface p-5 text-center transition-colors hover:border-brand hover:bg-brand-soft/40 focus-visible:border-brand"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                <o.icon className="h-6 w-6" />
              </span>
              <span className="text-[1.02rem] font-semibold text-ink">{t(o.titleKey)}</span>
              <span className="text-sm leading-snug text-ink-soft">{t(o.descKey)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={dismissChooser}
            className="rounded-full px-4 py-2 text-sm font-medium text-ink-faint transition-colors hover:text-ink focus-visible:text-ink"
          >
            {t("a11y.later")}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
