"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, CheckCircle2, X, Lock } from "lucide-react";
import { formatFare } from "@/lib/utils";

interface PermissionRequestModalProps {
  isOpen: boolean;
  onAuthorize: () => void;
  onDismiss: () => void;
  maxSpend?: number;
  primaryTrainName?: string;
  backupTrainName?: string;
  ptEligible?: boolean;
}

export function PermissionRequestModal({
  isOpen,
  onAuthorize,
  onDismiss,
  maxSpend = 7000,
  primaryTrainName = "Primary Express",
  backupTrainName = "Backup Express",
  ptEligible = true,
}: PermissionRequestModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl bg-surface border border-caution/40 shadow-2xl p-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-caution-soft text-caution flex items-center justify-center shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[0.68rem] font-black uppercase tracking-wider text-caution">
                  AUTHORIZATION ESCALATION
                </span>
                <h3 className="text-base font-bold text-ink">PERMISSION REQUEST</h3>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="rounded-lg p-1 text-ink-soft hover:text-ink hover:bg-surface-muted transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Context Explainer */}
          <div className="py-4 text-xs text-ink-soft space-y-1">
            <p className="font-semibold text-ink">
              You indicated that you won&apos;t be available at booking time.
            </p>
            <p className="leading-relaxed">
              To proceed autonomously at 10:00 AM, Copilot requires your explicit consent to transition from{" "}
              <strong className="text-ink">Assisted</strong> to{" "}
              <strong className="text-confirm">Permissioned</strong> mode.
            </p>
          </div>

          {/* Permissions Checklist */}
          <div className="rounded-xl bg-surface-muted/60 p-4 border border-line space-y-2.5 text-xs">
            <span className="text-[0.7rem] uppercase tracking-wider font-bold text-ink-soft block">
              Allow Copilot to:
            </span>

            <div className="flex items-start gap-2.5 text-ink">
              <CheckCircle2 className="h-4 w-4 text-confirm shrink-0 mt-0.5" />
              <span>
                Attempt the primary strategy (<strong>{primaryTrainName}</strong>)
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-ink">
              <CheckCircle2 className="h-4 w-4 text-confirm shrink-0 mt-0.5" />
              <span>
                Switch to prepared backup (<strong>{backupTrainName}</strong>) if unavailable
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-ink">
              <CheckCircle2 className="h-4 w-4 text-confirm shrink-0 mt-0.5" />
              <span>
                Use Premium Tatkal if enabled, eligible, and within limit
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-ink">
              <CheckCircle2 className="h-4 w-4 text-confirm shrink-0 mt-0.5" />
              <span>
                Stay strictly within authorized maximum spend (<strong>{formatFare(maxSpend)}</strong>)
              </span>
            </div>

            <div className="flex items-start gap-2.5 text-ink">
              <CheckCircle2 className="h-4 w-4 text-confirm shrink-0 mt-0.5" />
              <span>
                Stop immediately if any required condition or guard is not satisfied
              </span>
            </div>
          </div>

          {/* Boundaries reassurance */}
          <div className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] text-ink-soft font-mono">
            <Lock className="h-3 w-3 text-confirm" />
            <span>Boundaries enforced by Action Validator & Quota Policy</span>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft hover:bg-surface-muted transition cursor-pointer"
            >
              Remain Assisted
            </button>
            <button
              type="button"
              onClick={onAuthorize}
              className="px-5 py-2.5 rounded-xl bg-confirm hover:bg-confirm/90 text-white text-xs font-bold shadow-md shadow-confirm/20 transition flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Authorize Copilot</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
