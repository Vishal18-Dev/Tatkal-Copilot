"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  JourneyProvider,
  useJourney,
  useOptionalJourney,
  STEP_ORDER,
} from "@/lib/journey";
import { Step1PlanScreen } from "@/features/booking-flow/step1-plan-screen";
import { Step2OptionsScreen } from "@/features/booking-flow/step2-options-screen";
import { Step3PrepareScreen } from "@/features/booking-flow/step3-prepare-screen";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { Plan } from "@/types";

function PlanStage({
  initialGoal,
  fromVoice,
}: {
  initialGoal?: string;
  fromVoice?: boolean;
}) {
  const router = useRouter();
  const { t } = useLang();
  const { step, submitGoal, plan, goTo, setPlan, chooseOption } = useJourney();

  const STAGES: {
    step: "plan" | "options" | "prepare";
    num: string;
    label: string;
    sub: string;
  }[] = [
    { step: "plan", num: "01", label: t("stage.plan"), sub: t("stage.planSub") },
    { step: "options", num: "02", label: t("stage.options"), sub: t("stage.optionsSub") },
    { step: "prepare", num: "03", label: t("stage.prepare"), sub: t("stage.prepareSub") },
  ];
  const restoredRef = useRef(false);

  useEffect(() => {
    if (step === "book" || step === "review" || step === "authorize") {
      router.push("/app/book");
    }
  }, [step, router]);

  useEffect(() => {
    if (restoredRef.current) return;

    // ── Voice handoff: restore plan from sessionStorage ──────────────────
    // When the user came from the home-page voice workspace (from_voice=1),
    // the CopilotWorkspace stored the already-resolved Plan in sessionStorage.
    // We restore it directly via setPlan() so we never re-run generatePlan()
    // and throw away the route/trains/fare the voice agent already computed.
    if (fromVoice && !plan) {
      try {
        const stored = sessionStorage.getItem("tatkal_voice_result");
        if (stored) {
          restoredRef.current = true;
          const { plan: voicePlan, chosenOptionId } = JSON.parse(stored) as {
            plan: Plan;
            chosenOptionId: string;
          };
          sessionStorage.removeItem("tatkal_voice_result");
          setPlan(voicePlan);
          if (chosenOptionId) chooseOption(chosenOptionId);
          // Jump straight to Step 2 — the plan is already fully resolved
          setTimeout(() => goTo("options"), 50);
          return;
        }
      } catch {
        /* ignore — private browsing / sessionStorage unavailable */
      }
    }

    // ── Normal entry: ?goal=... URL param ────────────────────────────────
    if (initialGoal && !plan) {
      restoredRef.current = true;
      submitGoal(initialGoal);
    }
  }, [initialGoal, fromVoice, plan, submitGoal, setPlan, chooseOption, goTo]);

  const normalizedStep =
    step === "plan" || step === "compose" || step === "thinking"
      ? "plan"
      : step === "options" || step === "strategy"
      ? "options"
      : "prepare";

  const currentIdx = STAGES.findIndex((s) => s.step === normalizedStep);
  const pct = (Math.max(0, currentIdx >= 0 ? currentIdx : 0) / (STAGES.length - 1)) * 100;

  return (
    <div className="mx-auto -mt-2 max-w-5xl lg:-mt-4">
      {/* Dedicated Journey Stepper */}
      <nav
        aria-label="Booking flow progress"
        className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-xs"
      >
        {STAGES.map((s, i) => {
          const isCurrent = normalizedStep === s.step;
          const isPassed = currentIdx > i;

          return (
            <button
              key={s.step}
              type="button"
              onClick={() => goTo(s.step)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition cursor-pointer select-none",
                isCurrent
                  ? "bg-brand text-white shadow-xs"
                  : isPassed
                  ? "text-ink hover:bg-surface-muted"
                  : "text-ink-faint hover:bg-surface-muted/50"
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-bold font-mono transition",
                  isCurrent
                    ? "bg-white/20 text-white"
                    : isPassed
                    ? "bg-confirm-soft text-confirm"
                    : "bg-surface-muted text-ink-faint"
                )}
              >
                {isPassed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.num}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold leading-tight truncate">
                  {s.label}
                </div>
                <div
                  className={cn(
                    "hidden sm:block text-[0.68rem] truncate leading-tight mt-0.5",
                    isCurrent ? "text-white/80" : "text-ink-soft"
                  )}
                >
                  {s.sub}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="sticky top-16 z-30 -mx-4 mb-4 h-[2px] bg-transparent lg:-mx-8">
        <motion.div
          className="h-full bg-emerald-500"
          animate={{ width: `${Math.max(10, pct)}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>

      <AnimatePresence mode="wait">
        {(step === "plan" || step === "compose" || step === "thinking") && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Step1PlanScreen />
          </motion.div>
        )}
        {(step === "options" || step === "strategy") && (
          <motion.div
            key="options"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Step2OptionsScreen />
          </motion.div>
        )}
        {(step === "prepare" || step === "vault") && (
          <motion.div
            key="prepare"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Step3PrepareScreen />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanWithProvider({
  children,
  goal,
}: {
  children: React.ReactNode;
  goal?: string;
}) {
  const existing = useOptionalJourney();
  if (existing) {
    return <>{children}</>;
  }
  return <JourneyProvider initialGoal={goal}>{children}</JourneyProvider>;
}

function PlanInner() {
  const params = useSearchParams();
  const goal = params.get("goal") ?? undefined;
  const fromVoice = params.get("from_voice") === "1";
  return (
    <PlanWithProvider goal={goal}>
      <PlanStage initialGoal={goal} fromVoice={fromVoice} />
    </PlanWithProvider>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanInner />
    </Suspense>
  );
}


