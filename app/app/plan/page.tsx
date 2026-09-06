"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { JourneyProvider, useJourney, STEP_ORDER } from "@/lib/journey";
import { ComposeScreen } from "@/features/goal/compose-screen";
import { ThinkingScreen } from "@/features/thinking/thinking-screen";
import { StrategyScreen } from "@/features/strategy/strategy-screen";
import { VaultScreen } from "@/features/vault/vault-screen";
import { JourneyReviewScreen } from "@/features/review/journey-review-screen";
import { AuthorizeScreen } from "@/features/authorize/authorize-screen";

function PlanStage({ initialGoal }: { initialGoal?: string }) {
  const { step } = useJourney();
  const idx = STEP_ORDER.indexOf(step);
  const pct = (idx / (STEP_ORDER.length - 1)) * 100;

  return (
    <div className="mx-auto -mt-6 max-w-5xl lg:-mt-6">
      <div className="sticky top-16 z-30 -mx-4 mb-2 h-[3px] bg-transparent lg:-mx-8">
        <motion.div
          className="h-full bg-brand"
          animate={{ width: `${Math.max(6, pct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {step === "compose" && <ComposeScreen key="compose" initialGoal={initialGoal} />}
        {step === "thinking" && <ThinkingScreen key="thinking" />}
        {step === "strategy" && <StrategyScreen key="strategy" />}
        {step === "vault" && <VaultScreen key="vault" />}
        {step === "review" && <JourneyReviewScreen key="review" />}
        {step === "authorize" && <AuthorizeScreen key="authorize" />}
      </AnimatePresence>
    </div>
  );
}

function PlanInner() {
  const params = useSearchParams();
  const goal = params.get("goal") ?? undefined;
  return (
    <JourneyProvider initialGoal={goal}>
      <PlanStage initialGoal={goal} />
    </JourneyProvider>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanInner />
    </Suspense>
  );
}
