"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AuthModal({
  open,
  onClose,
  onAuthed,
  title,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed?: (isNew: boolean) => void;
  title?: string;
  reason?: string;
}) {
  const { requestOtp, verifyOtp } = useStore();
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage("phone");
    setPhone("");
    setCode("");
    setDemoCode(null);
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  function send() {
    setError(null);
    const res = requestOtp(phone);
    if (!res.ok) {
      setError(res.error ?? "Could not send code.");
      return;
    }
    setDemoCode(res.demoCode ?? null);
    setStage("otp");
  }

  function verify() {
    setError(null);
    const res = verifyOtp(code);
    if (!res.ok) {
      setError(res.error ?? "Could not verify.");
      return;
    }
    onAuthed?.(!!res.isNew);
    close();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="relative w-full max-w-sm rounded-[var(--radius-lg)] border border-line bg-surface p-7 shadow-[var(--shadow-lift)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
              {stage === "phone" ? <Phone className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
            </div>

            {stage === "phone" ? (
              <>
                <h3 className="mt-4 text-xl font-semibold text-ink">{title ?? "Sign in to continue"}</h3>
                <p className="mt-1.5 text-[0.95rem] text-ink-soft">
                  {reason ?? "We'll remember your travellers, trips and preferences."}
                </p>
                <label className="mt-5 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Mobile number
                  </span>
                  <div className="flex items-center rounded-xl border border-line-strong bg-surface px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                    <span className="text-ink-soft">+91</span>
                    <input
                      autoFocus
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                      placeholder="98XXXXXXXX"
                      className="w-full bg-transparent px-2.5 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                  </div>
                </label>
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <Button size="lg" className="mt-5 w-full group" disabled={phone.length !== 10} onClick={send}>
                  Send code
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </>
            ) : (
              <>
                <h3 className="mt-4 text-xl font-semibold text-ink">Enter the code</h3>
                <p className="mt-1.5 text-[0.95rem] text-ink-soft">
                  Sent to +91 {phone}.{" "}
                  <button onClick={() => setStage("phone")} className="font-medium text-brand hover:underline">
                    Change
                  </button>
                </p>
                {demoCode && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-caution/50 bg-caution-soft/50 px-3 py-2 text-sm text-caution">
                    <ShieldCheck className="h-4 w-4" />
                    Demo — no real SMS. Your code is <b className="tabular ml-1">{demoCode}</b>
                  </div>
                )}
                <input
                  autoFocus
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  placeholder="••••••"
                  className={cn(
                    "tabular mt-4 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-center text-2xl tracking-[0.4em] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  )}
                />
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <Button size="lg" className="mt-5 w-full" disabled={code.length !== 6} onClick={verify}>
                  Verify & continue
                </Button>
                <button
                  onClick={send}
                  className="mt-3 block w-full text-center text-sm font-medium text-ink-faint hover:text-ink"
                >
                  Resend code
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
