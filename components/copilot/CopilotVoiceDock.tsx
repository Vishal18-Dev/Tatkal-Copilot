"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, Volume2, Send, Sparkles, Keyboard } from "lucide-react";
import { useCopilotAsk } from "@/lib/copilot/use-copilot-ask";
import type { CopilotContext } from "@/lib/copilot";
import { useLang } from "@/lib/i18n";
import { VoiceLangSelect } from "@/components/voice/VoiceLangSelect";
import { cn } from "@/lib/utils";

export interface CopilotPrompt {
  /** Stable key for React + tests. */
  key: string;
  /** Shown on the chip (localised UI copy). */
  label: string;
  /** The question sent to the Copilot tools (English keywords route reliably). */
  question: string;
}

/**
 * Contextual voice for a live journey — the same Copilot brain, pointed at the
 * real Trip. Ask by tapping a prompt, typing, or speaking; answers are grounded
 * in the Copilot tools and spoken in the active language. Read-only: it never
 * books or mutates (spec §10/§11).
 */
export function CopilotVoiceDock({
  getContext,
  prompts,
  className,
}: {
  getContext: () => CopilotContext;
  prompts: CopilotPrompt[];
  className?: string;
}) {
  const { t } = useLang();
  const { state, turns, micSupported, micError, ask, askSpoken, stopSpoken } = useCopilotAsk(getContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const listening = state === "listening";
  const busy = state === "transcribing" || state === "thinking";
  const speaking = state === "speaking";

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function onMic() {
    if (listening) void stopSpoken();
    else void askSpoken();
  }

  function submitTyped() {
    const v = inputRef.current?.value.trim();
    if (!v || busy) return;
    if (inputRef.current) inputRef.current.value = "";
    void ask(v);
  }

  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-line bg-surface p-4", className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-ink">{t("copilot.dockTitle")}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex rounded-md border border-line bg-surface-muted px-2 py-0.5 text-[0.72rem] font-medium text-ink-soft">
            {getContext().trip?.mode === "assisted"
              ? "🤝 Assisted · Ask before acting"
              : "⚡ Permissioned · Can act automatically"}
          </span>
          <VoiceLangSelect className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 text-xs text-ink-soft focus-within:border-brand" />
        </div>
      </div>

      {/* Transcript */}
      {turns.length > 0 && (
        <div
          ref={logRef}
          role="log"
          aria-label={t("copilot.transcriptLabel")}
          aria-live="polite"
          className="mb-3 max-h-44 space-y-2 overflow-y-auto"
        >
          {turns.map((turn) => (
            <motion.div
              key={turn.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
            >
              <span
                className={cn(
                  "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-[0.88rem] leading-snug",
                  turn.role === "user"
                    ? "rounded-br-sm bg-brand text-white"
                    : "rounded-bl-sm bg-surface-muted text-ink"
                )}
              >
                {turn.text}
              </span>
            </motion.div>
          ))}
          {busy && (
            <div className="flex items-center gap-1.5 text-xs text-ink-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("copilot.thinking")}
            </div>
          )}
        </div>
      )}

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => ask(p.question)}
            disabled={busy || listening}
            className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[0.8rem] font-medium text-ink transition-colors hover:border-brand hover:text-brand-ink disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input row: type or speak */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
          <Keyboard className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            onKeyDown={(e) => e.key === "Enter" && submitTyped()}
            placeholder={t("copilot.askPlaceholder")}
            aria-label={t("copilot.askPlaceholder")}
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={submitTyped}
            disabled={busy}
            aria-label={t("copilot.send")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {micSupported && (
          <button
            onClick={onMic}
            disabled={busy}
            aria-label={listening ? t("voice.stop") : t("copilot.speak")}
            aria-pressed={listening}
            className={cn(
              "relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              listening ? "bg-danger" : "bg-brand hover:bg-brand-strong"
            )}
          >
            {listening && (
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-danger/40 motion-reduce:animate-none" />
            )}
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : listening ? (
              <Square className="h-4 w-4" fill="currentColor" />
            ) : speaking ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {micError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 text-xs text-ink-faint"
          >
            {t("copilot.micFallback")}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
