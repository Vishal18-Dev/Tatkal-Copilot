"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Consistent centered container + entrance animation for each story screen. */
export function StepShell({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "mx-auto w-full px-5 py-10 sm:py-14",
        wide ? "max-w-5xl" : "max-w-2xl",
        className
      )}
    >
      {children}
    </motion.section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-[0.78rem] font-semibold uppercase tracking-wide text-brand-ink">
      {children}
    </div>
  );
}
