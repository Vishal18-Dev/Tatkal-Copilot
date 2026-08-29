"use client";

import { StepShell, Eyebrow } from "@/components/step-shell";
import { GoalComposer } from "@/features/goal/goal-composer";
import { useLang } from "@/lib/i18n";

export function ComposeScreen() {
  const { t } = useLang();
  return (
    <StepShell>
      <Eyebrow>{t("goal.prompt")}</Eyebrow>
      <h2 className="text-headline">{t("goal.title")}</h2>
      <p className="mt-3 text-lg text-ink-soft">{t("goal.subtitle")}</p>
      <div className="mt-8">
        <GoalComposer />
      </div>
    </StepShell>
  );
}
