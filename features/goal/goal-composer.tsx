"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, ArrowRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { useInteractionMode } from "@/lib/interaction-mode";
import { VoiceConversation } from "@/components/voice/VoiceConversation";
import { cn } from "@/lib/utils";

/**
 * The unified journey input — TYPE or SPEAK as equal ways to express intent
 * (spec §7/§8: "don't add voice to the product, make the product speakable").
 * Typing composes a goal for the frozen planner; speaking opens the full
 * multilingual Copilot conversation, which hands the confirmed goal straight
 * back into this wizard. Both paths end at the same submitGoal.
 *
 * In voice / accessible interaction modes the speak affordance LEADS — it
 * becomes the hero and typing drops to a quiet secondary — so the product is
 * genuinely voice-first for people who chose that, without ever removing type.
 */
export function GoalComposer() {
  const { submitGoal } = useJourney();
  const { t } = useLang();
  const { mode } = useInteractionMode();
  const [value, setValue] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const voiceFirst = mode === "voice" || mode === "accessible";

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

  const typeBlock = (
    <div className="rounded-[var(--radius-lg)] border border-line-strong bg-surface p-3.5 text-left shadow-[var(--shadow-card)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={2}
        aria-label={t("goal.title")}
        placeholder={t("goal.placeholder")}
        className="w-full resize-none bg-transparent px-3 py-2 text-xl leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 px-1 pt-1">
        <span className="text-xs text-ink-faint">
          <CornerDownLeft className="mr-1 inline h-3.5 w-3.5" />
          ⌘+Enter
        </span>
        <Button size="md" disabled={!canSubmit} onClick={submit} className="group">
          {t("goal.submit")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </div>
  );

  // SPEAK — opens the full multilingual Copilot conversation. Emphasized (hero)
  // when voice leads; a calm equal otherwise.
  const speakBlock = (
    <button
      type="button"
      onClick={() => setVoiceOpen(true)}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-[var(--radius-lg)] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        voiceFirst
          ? "border-2 border-brand bg-brand-soft/60 p-5 hover:bg-brand-soft sm:p-6"
          : "border border-brand/30 bg-brand-soft/40 p-4 hover:bg-brand-soft"
      )}
    >
      <span
        className={cn(
          "relative grid shrink-0 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-brand)]",
          voiceFirst ? "h-14 w-14" : "h-12 w-12"
        )}
      >
        <Mic className={voiceFirst ? "h-6 w-6" : "h-5 w-5"} />
        <span
          className={cn(
            "absolute inset-0 -z-10 rounded-full bg-brand/30",
            voiceFirst
              ? "animate-ping motion-reduce:animate-none"
              : "transition-transform duration-500 group-hover:scale-125 motion-reduce:transition-none"
          )}
        />
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold text-brand-ink", voiceFirst ? "text-lg" : "text-[1.02rem]")}>
          {t("goal.speakTitle")}
        </span>
        <span className="block text-sm text-ink-soft">{t("goal.speakSub")}</span>
      </span>
      <ArrowRight
        className={cn(
          "ml-auto shrink-0 text-brand transition-transform group-hover:translate-x-1",
          voiceFirst ? "h-6 w-6" : "h-5 w-5"
        )}
      />
    </button>
  );

  const divider = (
    <div className="my-4 flex items-center gap-3 text-ink-faint" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide">
        {voiceFirst ? t("goal.orType") : t("goal.or")}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );

  return (
    <div className="w-full">
      {voiceFirst ? (
        <>
          {speakBlock}
          {divider}
          {typeBlock}
        </>
      ) : (
        <>
          {typeBlock}
          {divider}
          {speakBlock}
        </>
      )}

      {/* Example journeys — one tap to prefill the typed goal */}
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

      <AnimatePresence>
        {voiceOpen && (
          <VoiceConversation
            key="plan-voice"
            onClose={() => setVoiceOpen(false)}
            onConfirmGoal={(goal) => submitGoal(goal)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
