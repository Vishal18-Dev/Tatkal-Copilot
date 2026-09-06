"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { PhoneCall } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { CallScreen } from "./CallScreen";

/** Triggers a simulated proactive call from Copilot. Drop anywhere. */
export function CallButton({ className }: { className?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 h-9 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
        }
      >
        <PhoneCall className="h-4 w-4" />
        {t("call.trigger")}
      </button>
      <AnimatePresence>{open && <CallScreen key="call-screen" onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
