"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import type { VoiceTurn } from "@/lib/voice/types";
import type { ConversationMessage } from "@/lib/conversation/types";
import { toVoiceTurn } from "@/lib/conversation/adapters";

/** The call-log style transcript — user lines right-aligned, agent lines left. */
export function VoiceTranscript({
  turns,
  messages,
  interimTranscript,
  highlightTerms,
  highlightTurnId,
}: {
  turns?: VoiceTurn[];
  messages?: ConversationMessage[];
  /** Ephemeral in-flight speech recognition (not persisted). */
  interimTranscript?: string | null;
  /** Words/phrases (from the grounded plan intent) to visually call out — never invented. */
  highlightTerms?: string[];
  /** Only this turn gets highlighted — the original goal utterance, not later yes/no replies. */
  highlightTurnId?: string;
}) {
  const { t } = useLang();
  const displayTurns = turns ?? (messages ? messages.map(toVoiceTurn) : []);
  if (displayTurns.length === 0 && !interimTranscript) return null;
  return (
    <div className="flex w-full flex-col gap-2" role="log" aria-label={t("voice.transcriptLabel")}>
      {displayTurns.map((turn) => (
        <motion.div
          key={turn.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
        >
          <span
            className={cn(
              "max-w-[85%] rounded-[var(--radius)] px-3.5 py-2 text-[0.92rem] leading-snug",
              turn.role === "user" ? "bg-brand text-white" : "bg-surface-muted text-ink"
            )}
          >
            {turn.id === highlightTurnId && highlightTerms?.length ? (
              <Highlighted text={turn.text} terms={highlightTerms} />
            ) : (
              turn.text
            )}
          </span>
        </motion.div>
      ))}
      {interimTranscript && (
        <motion.div
          key="interim_transcript"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-end"
        >
          <span className="max-w-[85%] rounded-[var(--radius)] px-3.5 py-2 text-[0.92rem] leading-snug bg-brand/80 text-white italic animate-pulse border border-white/20">
            {interimTranscript}
          </span>
        </motion.div>
      )}
    </div>
  );
}

/** Bolds the recognized entities (city, class, passenger count) inside a spoken sentence. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const cleaned = terms.filter(Boolean);
  if (cleaned.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${cleaned.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        cleaned.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded bg-white/25 px-0.5 font-semibold text-white">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
