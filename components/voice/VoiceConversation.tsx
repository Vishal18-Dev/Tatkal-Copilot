"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { CopilotWorkspace } from "@/components/copilot/CopilotWorkspace";
import type { Plan } from "@/types";

const emptySubscribe = () => () => {};

export function VoiceConversation({
  onClose,
  onConfirmGoal,
  initialGoal,
}: {
  onClose: () => void;
  onConfirmGoal?: (goal: string, plan: Plan) => void;
  initialGoal?: string;
}) {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  function handleConfirm(goal: string, plan: Plan) {
    if (onConfirmGoal) {
      onConfirmGoal(goal, plan);
    } else {
      router.push(`/app/plan?goal=${encodeURIComponent(goal)}`);
    }
    onClose();
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[65] flex flex-col bg-canvas/95 backdrop-blur-sm overflow-y-auto p-4 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Tatkal Copilot"
    >
      <div className="relative mx-auto w-full max-w-3xl rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] my-auto">
        <button
          onClick={onClose}
          aria-label="Close Tatkal Copilot"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        <CopilotWorkspace initialGoal={initialGoal} onPrepareTatkal={(plan) => handleConfirm(plan.intent.from ? `${plan.intent.from} to ${plan.intent.to}` : "journey", plan)} />
      </div>
    </motion.div>,
    document.body
  );
}


