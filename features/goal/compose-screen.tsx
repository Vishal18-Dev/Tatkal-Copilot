"use client";

import { motion } from "framer-motion";
import { Clock, GitBranch, ShieldCheck } from "lucide-react";
import { StepShell } from "@/components/step-shell";
import { CopilotWorkspace } from "@/components/copilot/CopilotWorkspace";
import { useLang } from "@/lib/i18n";

export function ComposeScreen({ initialGoal }: { initialGoal?: string }) {
  const { t } = useLang();
  return (
    <StepShell wide>
      <div className="mx-auto max-w-3xl">
        <CopilotWorkspace initialGoal={initialGoal} />
      </div>

      <div className="mx-auto mt-10 max-w-4xl">
        <Promises />
      </div>
    </StepShell>
  );
}

const PROMISES = [
  { icon: Clock, title: "plan.watchTitle", body: "plan.watchBody" },
  { icon: GitBranch, title: "plan.backupTitle", body: "plan.backupBody" },
  { icon: ShieldCheck, title: "plan.controlTitle", body: "plan.controlBody" },
] as const;

function Promises() {
  const { t } = useLang();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PROMISES.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[var(--radius-lg)] border border-line bg-surface p-5"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
            <p.icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <h3 className="mt-3 text-[0.95rem] font-semibold text-brand-ink">
            {t(p.title)}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t(p.body)}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

