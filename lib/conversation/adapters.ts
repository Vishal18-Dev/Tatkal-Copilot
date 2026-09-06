import type { VoiceTurn } from "@/lib/voice/types";
import type { CopilotTurn } from "@/lib/copilot/use-copilot-ask";
import type { CallLine } from "@/lib/calling/conversation";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import type {
  ConversationChannel,
  ConversationMessage,
  ConversationRole,
} from "./types";
import type { VoiceLang } from "@/lib/voice/languages";

/* ============================================================
   Conversation Adapters

   Provides bidirectional conversions between legacy interface-specific
   turn representations and the canonical ConversationMessage model.
   This guarantees 100% backwards compatibility while providing an
   incremental migration path.
   ============================================================ */

/**
 * Convert legacy browser VoiceTurn into a canonical ConversationMessage.
 */
export function fromVoiceTurn(
  turn: VoiceTurn,
  options?: {
    conversationId?: string;
    channel?: ConversationChannel;
    language?: VoiceLang;
    normalizedText?: string;
  }
): ConversationMessage {
  const role: ConversationRole = turn.role === "agent" ? "assistant" : "user";
  const now = new Date().toISOString();
  return {
    id: turn.id,
    conversationId: options?.conversationId ?? "conv_voice_legacy",
    role,
    channel: options?.channel ?? "browser_voice",
    originalText: turn.text,
    normalizedText: options?.normalizedText,
    language: options?.language,
    status: turn.final ? "final" : "interim",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a canonical ConversationMessage into a legacy browser VoiceTurn.
 * The visible text preserves original spoken transcript (AUTHORITATIVE).
 */
export function toVoiceTurn(msg: ConversationMessage): VoiceTurn {
  return {
    id: msg.id,
    role: msg.role === "assistant" ? "agent" : "user",
    text: msg.originalText,
    final: msg.status === "final",
  };
}

/**
 * Convert visual Copilot dock turn into a canonical ConversationMessage.
 */
export function fromCopilotTurn(
  turn: CopilotTurn,
  options?: {
    conversationId?: string;
    channel?: ConversationChannel;
    language?: VoiceLang;
  }
): ConversationMessage {
  const role: ConversationRole = turn.role === "agent" ? "assistant" : "user";
  const now = new Date().toISOString();
  return {
    id: turn.id,
    conversationId: options?.conversationId ?? "conv_dock_legacy",
    role,
    channel: options?.channel ?? "visual",
    originalText: turn.text,
    language: options?.language,
    status: "final",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a canonical ConversationMessage into a visual CopilotTurn.
 */
export function toCopilotTurn(msg: ConversationMessage): CopilotTurn {
  return {
    id: msg.id,
    role: msg.role === "assistant" ? "agent" : "user",
    text: msg.originalText,
  };
}

/**
 * Convert calling script line into a canonical ConversationMessage.
 */
export function fromCallLine(
  line: CallLine,
  options?: {
    conversationId?: string;
    language?: VoiceLang;
  }
): ConversationMessage {
  const now = new Date().toISOString();
  return {
    id: line.id,
    conversationId: options?.conversationId ?? "conv_phone_legacy",
    role: "assistant",
    channel: "phone",
    originalText: line.text,
    language: options?.language,
    status: "final",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a canonical ConversationMessage into a CallLine.
 */
export function toCallLine(msg: ConversationMessage): CallLine {
  return {
    id: msg.id,
    text: msg.originalText,
  };
}

/**
 * Convert WhatsApp message bubble into a canonical ConversationMessage.
 */
export function fromWhatsAppMessage(
  waMsg: WhatsAppMessage,
  options?: {
    conversationId?: string;
    language?: VoiceLang;
  }
): ConversationMessage {
  const role: ConversationRole = waMsg.role === "copilot" ? "assistant" : "user";
  const now = new Date().toISOString();
  return {
    id: waMsg.id,
    conversationId: options?.conversationId ?? "conv_wa_legacy",
    role,
    channel: "whatsapp",
    originalText: waMsg.text,
    language: options?.language,
    status: "final",
    createdAt: waMsg.time || now,
    updatedAt: waMsg.time || now,
  };
}

/**
 * Convert a canonical ConversationMessage into a WhatsAppMessage.
 */
export function toWhatsAppMessage(msg: ConversationMessage): WhatsAppMessage {
  return {
    id: msg.id,
    role: msg.role === "assistant" ? "copilot" : "user",
    text: msg.originalText,
    time: msg.createdAt,
  };
}
