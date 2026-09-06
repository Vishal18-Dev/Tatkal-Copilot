"use client";

import { useCallback, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { QuickReplyKind, WhatsAppMessage, WhatsAppRespondResult } from "./types";

let seq = 0;
const nextId = () => `wa_${Date.now()}_${seq++}`;
const now = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

// Mirrors the exact phrasing features/goal/journey-form.tsx composes from its
// structured pills — proven to parse correctly via parseIntentLocally, kept
// identical here rather than inventing new wording for the same intent.
const PREFERENCE_PHRASE: Record<Exclude<QuickReplyKind, "show_other">, string> = {
  best_chance: "the best chance of a confirmed seat",
  fastest: "reach as early as possible",
  cheapest: "the cheapest confirmed option",
};

export function useWhatsAppConversation(lang: Lang) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [awaitingPreference, setAwaitingPreference] = useState(false);
  const goalRef = useRef("");

  const pushCopilot = useCallback((r: WhatsAppRespondResult) => {
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "copilot", text: r.reply, quickReplies: r.quickReplies, cta: r.cta, time: now() },
    ]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((m) => [...m, { id: nextId(), role: "user", text, time: now() }]);
  }, []);

  const callApi = useCallback(
    async (message: string, stage: "goal" | "preference") => {
      setSending(true);
      try {
        const res = await fetch("/api/whatsapp/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, stage, lang }),
        });
        if (!res.ok) throw new Error(`whatsapp respond ${res.status}`);
        const data = (await res.json()) as WhatsAppRespondResult;
        pushCopilot(data);
        setAwaitingPreference(stage === "goal");
      } catch {
        pushCopilot({
          reply:
            lang === "hi"
              ? "माफ़ करें, अभी जवाब नहीं दे पाया। फिर कोशिश करें।"
              : "Sorry, I couldn't respond just now. Please try again.",
        });
      } finally {
        setSending(false);
      }
    },
    [lang, pushCopilot]
  );

  /** Free-text send — always treated as a fresh goal (first turn). */
  const sendGoal = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      goalRef.current = trimmed;
      pushUser(trimmed);
      await callApi(trimmed, "goal");
    },
    [sending, pushUser, callApi]
  );

  /** Tapping a preference/quick-reply chip. */
  const tapQuickReply = useCallback(
    async (kind: QuickReplyKind, label: string) => {
      if (sending) return;
      pushUser(label);
      if (kind === "show_other") {
        // Options already lists every alternative — same destination as "yes".
        await callApi(goalRef.current, "preference");
        return;
      }
      const combined = `${goalRef.current}, ${PREFERENCE_PHRASE[kind]}`;
      goalRef.current = combined;
      await callApi(combined, "preference");
    },
    [sending, pushUser, callApi]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAwaitingPreference(false);
    goalRef.current = "";
  }, []);

  return { messages, sending, awaitingPreference, sendGoal, tapQuickReply, reset };
}
