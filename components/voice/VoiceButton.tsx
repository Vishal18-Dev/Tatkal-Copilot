"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { VoiceConversation } from "./VoiceConversation";

/** Opens the voice agent panel. Drop this anywhere — header, FAB, etc. */
export function VoiceButton({ className }: { className?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("voice.openLabel")}
        aria-haspopup="dialog"
        className={
          className ??
          "grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink"
        }
      >
        <Mic className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && <VoiceConversation key="voice-conversation" onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
