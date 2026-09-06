"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Mic } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useInteractionMode } from "@/lib/interaction-mode";
import { VoiceConversation } from "./VoiceConversation";

/**
 * Opens the voice agent. Drop this anywhere — header, FAB, etc. In voice /
 * accessible interaction modes it becomes a labelled, brand-filled pill so
 * voice is the obvious way in from anywhere in the app; otherwise it stays a
 * quiet icon that doesn't compete with the rest of the header.
 */
export function VoiceButton({ className }: { className?: string }) {
  const { t } = useLang();
  const { mode } = useInteractionMode();
  const [open, setOpen] = useState(false);

  const voiceFirst = mode === "voice" || mode === "accessible";

  const defaultClass = voiceFirst
    ? "inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition hover:opacity-90"
    : "grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("voice.openLabel")}
        aria-haspopup="dialog"
        className={className ?? defaultClass}
      >
        <Mic className="h-4 w-4" />
        {voiceFirst && !className && (
          <span className="hidden sm:inline">{t("voice.speakShort")}</span>
        )}
      </button>
      <AnimatePresence>
        {open && <VoiceConversation key="voice-conversation" onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
