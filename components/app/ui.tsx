"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface/50 px-6 py-16 text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-ink-soft">{body}</p>
      {actionLabel &&
        (actionHref ? (
          <Link href={actionHref} className="mt-5">
            <Button size="md">{actionLabel}</Button>
          </Link>
        ) : (
          <Button size="md" className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ))}
    </motion.div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "confirm" | "caution" | "danger";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-muted text-ink-soft",
    brand: "bg-brand-soft text-brand-ink",
    confirm: "bg-confirm-soft text-confirm",
    caution: "bg-caution-soft text-caution",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-caution/40 bg-caution-soft px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wide text-caution",
        className
      )}
    >
      Demo
    </span>
  );
}
