"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ShieldCheck, X, Loader2, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";

type Step = "consent" | "verifying" | "verified";

/**
 * Simulated identity verification: Consent → Verify → Ready. Runs through the
 * store's provider-backed `verifyIdentity` (a deterministic mock). No real
 * Aadhaar number or OTP is ever requested — clearly labelled DEMO throughout.
 */
export function IdentityModal({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { identity, verifyIdentity, user, travellers } = useStore();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(identity.status === "verified" ? "verified" : "consent");
  const [name, setName] = useState(
    identity.holderName || user?.name || travellers[0]?.name || ""
  );
  const [consented, setConsented] = useState(false);
  const returnFocus = useRef<Element | null>(null);

  useEffect(() => {
    setMounted(true);
    returnFocus.current = document.activeElement;
    return () => {
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!name.trim() || !consented) return;
    setStep("verifying");
    await verifyIdentity(name.trim());
    setStep("verified");
  }

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-lift)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-title"
      >
        <button
          onClick={onClose}
          aria-label={t("id.close")}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft text-brand">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 id="identity-title" className="flex items-center gap-2 text-lg font-semibold text-ink">
              {t("id.consentTitle")} <DemoBadge />
            </h2>
            <p className="text-xs text-ink-faint">{t("id.subtitle")}</p>
          </div>
        </div>

        {step === "consent" && (
          <div className="mt-4">
            <p className="text-[0.9rem] leading-relaxed text-ink-soft">{t("id.consentBody")}</p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {t("id.nameLabel")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("id.namePlaceholder")}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />

            <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[0.85rem] text-ink">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              {t("id.consentCheck")}
            </label>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-[0.78rem] text-ink-soft">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              {t("id.demoNote")}
            </div>

            <Button
              size="lg"
              onClick={submit}
              disabled={!name.trim() || !consented}
              className="mt-4 w-full"
            >
              <ShieldCheck className="h-5 w-5" />
              {t("id.verifyCta")}
            </Button>
          </div>
        )}

        {step === "verifying" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
            <p className="text-[0.95rem] font-medium text-ink">{t("id.verifying")}</p>
            <p className="text-xs text-ink-faint">{t("id.verifyingNote")}</p>
          </div>
        )}

        {step === "verified" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="grid h-16 w-16 place-items-center rounded-full bg-confirm text-white"
            >
              <Check className="h-8 w-8" strokeWidth={3} />
            </motion.span>
            <h3 className="text-lg font-semibold text-ink">{t("id.verifiedTitle")}</h3>
            <p className="max-w-xs text-sm text-ink-soft">{t("id.verifiedBody")}</p>
            {identity.maskedRef && (
              <div className="tabular rounded-xl bg-surface-muted px-3 py-1.5 font-mono text-sm text-ink-soft">
                {t("id.refLabel")}: {identity.maskedRef}
              </div>
            )}
            <Button size="md" onClick={onClose} className="mt-2">
              {t("id.done")}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
