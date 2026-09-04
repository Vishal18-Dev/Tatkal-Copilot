"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

/** The conversational travel-goal input. Lives on the landing page. */
export function GoalComposer() {
  const { submitGoal } = useJourney();
  const { t, lang } = useLang();
  const [value, setValue] = useState("");
  const speech = useSpeech(lang);

  useEffect(() => {
    if (speech.transcript) setValue(speech.transcript);
  }, [speech.transcript]);

  const examples = [
    t("goal.example1"),
    t("goal.example2"),
    t("goal.example3"),
    t("goal.example4"),
  ];
  const canSubmit = value.trim().length > 3;

  function submit() {
    if (canSubmit) submitGoal(value.trim());
  }

  return (
    <div className="w-full">
      <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3.5 text-left shadow-[var(--shadow-card)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={2}
          aria-label={t("goal.title")}
          placeholder={speech.listening ? t("goal.listening") : t("goal.placeholder")}
          className="w-full resize-none bg-transparent px-3 py-2 text-xl leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          {speech.supported ? (
            <button
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 h-10 text-sm font-medium transition-colors",
                speech.listening
                  ? "bg-danger-soft text-danger"
                  : "bg-surface-muted text-ink-soft hover:text-ink"
              )}
              aria-label={t("goal.mic")}
            >
              <span className="relative flex h-4 w-4 items-center justify-center">
                <Mic className="h-4 w-4" />
                {speech.listening && (
                  <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-danger/40" />
                )}
              </span>
              {speech.listening ? t("goal.listening") : t("goal.mic")}
            </button>
          ) : (
            <span className="text-xs text-ink-faint">
              <CornerDownLeft className="mr-1 inline h-3.5 w-3.5" />
              ⌘+Enter
            </span>
          )}

          <Button size="md" disabled={!canSubmit} onClick={submit} className="group">
            {t("goal.submit")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {examples.map((ex, i) => (
          <motion.button
            key={ex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.06 }}
            whileHover={{ y: -2 }}
            onClick={() => setValue(ex)}
            className="rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink-soft transition-colors hover:border-brand/40 hover:bg-brand-soft/50 hover:text-ink"
          >
            {ex}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
