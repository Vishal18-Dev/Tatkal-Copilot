"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, MessageCircle, Loader2, ArrowRight, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/app/ui";
import { useLang } from "@/lib/i18n";
import { useWhatsAppConversation } from "@/lib/whatsapp/conversation";
import { cn } from "@/lib/utils";
import type { QuickReplyKind, WhatsAppMessage } from "@/lib/whatsapp/types";

/**
 * A simulated WhatsApp-style conversational entry point into the same
 * planner every other surface uses. No real WhatsApp message is ever sent —
 * this is a demo of the channel, clearly labeled as such throughout.
 */
export function WhatsAppThread() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { messages, sending, awaitingPreference, sendGoal, tapQuickReply, reset } =
    useWhatsAppConversation(lang);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function submit() {
    if (!input.trim() || sending) return;
    void sendGoal(input);
    setInput("");
  }

  function openInCopilot(goal: string) {
    router.push(`/app/plan?goal=${encodeURIComponent(goal)}`);
  }

  return (
    <Card className="flex h-[70vh] min-h-[520px] flex-col overflow-hidden p-0">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-line bg-surface-muted/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">{t("wa.threadTitle")}</div>
            <div className="text-xs text-ink-faint">{t("wa.threadSubtitle")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge />
          {messages.length > 0 && (
            <button
              onClick={reset}
              aria-label={t("wa.restart")}
              className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas/40 px-4 py-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <MessageCircle className="mx-auto h-8 w-8 text-ink-faint" />
              <p className="mt-3 text-[0.95rem] text-ink-soft">{t("wa.emptyTitle")}</p>
              <p className="mt-1 text-xs text-ink-faint">{t("wa.emptyHint")}</p>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onQuickReply={tapQuickReply} onOpenCopilot={openInCopilot} />
        ))}
        {sending && (
          <div className="flex justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-surface-muted px-3.5 py-2.5 text-sm text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("wa.typing")}
            </span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-surface p-3">
        {awaitingPreference && (
          <p className="mb-2 text-center text-[0.7rem] text-ink-faint">{t("wa.tapAChip")}</p>
        )}
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-muted/60 px-3.5 py-1.5 focus-within:border-brand">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            disabled={sending}
            placeholder={t("wa.inputPlaceholder")}
            className="h-9 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={sending || !input.trim()}
            aria-label={t("wa.send")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function MessageBubble({
  message,
  onQuickReply,
  onOpenCopilot,
}: {
  message: WhatsAppMessage;
  onQuickReply: (kind: QuickReplyKind, label: string) => void;
  onOpenCopilot: (goal: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}
    >
      <span
        className={cn(
          "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.92rem] leading-snug",
          isUser ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface-muted text-ink"
        )}
      >
        {renderMarkdownLite(message.text)}
      </span>
      <span className="px-1 text-[0.65rem] text-ink-faint">{message.time}</span>

      {!isUser && message.quickReplies && message.quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {message.quickReplies.map((qr) => (
            <button
              key={qr.kind}
              onClick={() => onQuickReply(qr.kind, qr.label)}
              className="rounded-full border border-brand/30 bg-brand-soft/60 px-3 py-1.5 text-[0.8rem] font-medium text-brand-ink transition-colors hover:bg-brand-soft"
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {!isUser && message.cta && (
        <button
          onClick={() => onOpenCopilot(message.cta!.goal)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
        >
          {message.cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

/** *bold* → <strong>, kept minimal — this is a chat bubble, not a markdown renderer. */
function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) =>
    part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
      <strong key={i}>{part.slice(1, -1)}</strong>
    ) : (
      part
    )
  );
}
