"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, X, Plus, ShieldCheck, ArrowRight, Check } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatFare } from "@/lib/utils";

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
  recommendedTopUp?: number;
}

export function AddMoneyModal({
  isOpen,
  onClose,
  onSuccess,
  recommendedTopUp = 2000,
}: AddMoneyModalProps) {
  const { wallet, creditWallet, logActivity } = useStore();
  const [selectedAmount, setSelectedAmount] = useState<number>(recommendedTopUp > 0 ? recommendedTopUp : 2000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const currentBalance = wallet.balance;
  const effectiveAddAmount = customAmount ? Math.max(0, parseInt(customAmount, 10) || 0) : selectedAmount;
  const newBalance = currentBalance + effectiveAddAmount;

  const quickAmounts = [1000, 2000, 5000];

  const handleAddMoney = () => {
    if (effectiveAddAmount <= 0) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const res = creditWallet(effectiveAddAmount);
      logActivity([
        {
          kind: "payment_event",
          text: `Rail Wallet credited with ${formatFare(effectiveAddAmount)}. New balance: ${formatFare(res.newBalance)}.`,
        },
      ]);
      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.(res.newBalance);
        onClose();
      }, 700);
    }, 400);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl bg-surface border border-line shadow-2xl p-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Add money to Rail Wallet</h3>
                <p className="text-xs text-ink-soft">Instant simulated top-up for Tatkal readiness</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-soft hover:text-ink hover:bg-surface-muted transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Current & New Balance display */}
          <div className="my-5 p-4 rounded-xl bg-surface-muted/60 border border-line/70 flex items-center justify-between">
            <div>
              <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-ink-soft">
                Current Balance
              </span>
              <div className="font-mono text-lg font-bold text-ink">
                {formatFare(currentBalance)}
              </div>
            </div>

            <ArrowRight className="h-4 w-4 text-ink-soft" />

            <div className="text-right">
              <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-brand">
                New Balance Preview
              </span>
              <div className="font-mono text-lg font-bold text-brand">
                {formatFare(newBalance)}
              </div>
            </div>
          </div>

          {/* Quick Amount Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-ink block">Select amount to add</label>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount("");
                  }}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    selectedAmount === amt && !customAmount
                      ? "border-brand bg-brand-soft text-brand font-black"
                      : "border-line bg-surface hover:bg-surface-muted text-ink"
                  }`}
                >
                  <Plus className="h-3 w-3" />
                  <span>+{formatFare(amt)}</span>
                </button>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="pt-2">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-soft">
                  ₹
                </span>
                <input
                  type="number"
                  placeholder="Or enter custom amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(0);
                  }}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-line bg-surface text-xs font-semibold text-ink focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          {/* Subtle Demo Disclosure */}
          <div className="mt-5 p-3 rounded-xl bg-caution-soft/40 border border-caution/20 text-[0.72rem] text-caution flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>Demo Environment:</strong> Simulated stored-value balance for Tatkal readiness testing. No real UPI or bank account charge.
            </span>
          </div>

          {/* Submit CTA */}
          <div className="mt-5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-soft hover:bg-surface-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || effectiveAddAmount <= 0}
              onClick={handleAddMoney}
              className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold shadow-md shadow-brand/20 transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSuccess ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Added {formatFare(effectiveAddAmount)}!</span>
                </>
              ) : (
                <span>Add {formatFare(effectiveAddAmount)}</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
