import type { Plan, StrategyOption } from "@/types";
import type { Lang } from "@/lib/i18n";

/** A stable, locale-independent key for a quick-reply action. */
export type QuickReplyKind = "best_chance" | "fastest" | "cheapest" | "show_other";

export interface QuickReply {
  kind: QuickReplyKind;
  label: string;
}

/** One bubble in the simulated WhatsApp thread. */
export interface WhatsAppMessage {
  id: string;
  role: "user" | "copilot";
  text: string;
  /** Tappable quick-reply chips shown under a copilot message. */
  quickReplies?: QuickReply[];
  /** A CTA that hands off to the real /app/plan wizard rather than a reply. */
  cta?: { label: string; goal: string };
  time: string;
}

export interface WhatsAppRespondRequest {
  message: string;
  lang?: Lang;
}

export interface WhatsAppRespondResult {
  reply: string;
  quickReplies?: QuickReply[];
  cta?: { label: string; goal: string };
  plan?: Plan;
  recommended?: StrategyOption;
}
