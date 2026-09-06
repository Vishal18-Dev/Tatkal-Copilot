import type { VoiceLang } from "@/lib/voice/languages";
import type {
  Conversation,
  ConversationChannel,
  ConversationContext,
  ConversationMessage,
  StructuredContextTurn,
  ToolActionMetadata,
} from "./types";

let seq = 0;
export const nextMessageId = (prefix = "msg"): string => `${prefix}_${Date.now()}_${seq++}`;
export const nextConversationId = (prefix = "conv"): string => `${prefix}_${Date.now()}_${seq++}`;

/**
 * Initialize a new canonical conversation session.
 */
export function createConversation(options: {
  id?: string;
  channel: ConversationChannel;
  language?: VoiceLang;
  sessionId?: string;
  tripId?: string;
  metadata?: Record<string, unknown>;
  initialMessages?: ConversationMessage[];
}): Conversation {
  const now = new Date().toISOString();
  return {
    id: options.id ?? nextConversationId(),
    channel: options.channel,
    language: options.language,
    sessionId: options.sessionId,
    tripId: options.tripId,
    metadata: options.metadata ?? {},
    messages: options.initialMessages ? [...options.initialMessages] : [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Append a new canonical message to the conversation.
 * Ensures timestamps, ID, and immutable conversation references are set.
 */
export function addMessage(
  conversation: Conversation,
  input: Omit<ConversationMessage, "id" | "conversationId" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): { conversation: Conversation; message: ConversationMessage } {
  const now = new Date().toISOString();
  const message: ConversationMessage = {
    ...input,
    id: input.id ?? nextMessageId(),
    conversationId: conversation.id,
    channel: input.channel ?? conversation.channel,
    language: input.language ?? conversation.language,
    status: input.status ?? "final",
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  const updatedConversation: Conversation = {
    ...conversation,
    updatedAt: now,
    language: message.language ?? conversation.language,
    messages: [...conversation.messages, message],
  };

  return { conversation: updatedConversation, message };
}

/**
 * Update an existing message within the conversation (e.g. status transition from interim to final,
 * or attaching normalized text / audio metadata).
 */
export function updateMessage(
  conversation: Conversation,
  messageId: string,
  updates: Partial<Omit<ConversationMessage, "id" | "conversationId">>
): Conversation {
  const now = new Date().toISOString();
  let updated = false;

  const messages = conversation.messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    updated = true;
    return {
      ...msg,
      ...updates,
      updatedAt: now,
    };
  });

  if (!updated) return conversation;

  return {
    ...conversation,
    updatedAt: now,
    messages,
  };
}

/**
 * Retrieve a bounded, structured context window suitable for feeding
 * to LLMs, voice reasoning engines, or agent prompts.
 *
 * Rules:
 * 1. Bounded: Never sends unbounded history; capped by `maxMessages` (default: 10).
 * 2. Structured: Formats as clean `{ role, content, originalText, language, intent, timestamp }` turns.
 * 3. Reasoning content preference:
 *    - "normalized_first": uses `normalizedText` (English) if available, falling back to `originalText`.
 *    - "original_first": uses `originalText` directly.
 */
export function getRecentContext(
  conversation: Conversation,
  options?: {
    maxMessages?: number;
    includeToolMessages?: boolean;
    reasoningPreference?: "normalized_first" | "original_first";
  }
): ConversationContext {
  const max = options?.maxMessages ?? 10;
  const includeTools = options?.includeToolMessages ?? false;
  const pref = options?.reasoningPreference ?? "normalized_first";

  // Filter messages
  const candidateMessages = conversation.messages.filter((msg) => {
    if (msg.status === "error") return false;
    if (!includeTools && msg.role === "tool") return false;
    return true;
  });

  // Take the most recent `max` messages
  const windowSlice = candidateMessages.slice(-max);

  const turns: StructuredContextTurn[] = windowSlice.map((msg) => {
    const content =
      pref === "normalized_first"
        ? (msg.normalizedText?.trim() || msg.originalText)
        : msg.originalText;

    return {
      role: msg.role,
      content,
      originalText: msg.originalText,
      language: msg.language,
      intent: msg.intent,
      timestamp: msg.createdAt,
    };
  });

  return {
    conversationId: conversation.id,
    channel: conversation.channel,
    language: conversation.language,
    turns,
    totalMessagesCount: conversation.messages.length,
  };
}

/**
 * Records a grounded tool invocation and result as an audit / context entry.
 *
 * CRITICAL SAFETY BOUNDARY:
 * This helper ONLY logs what happened in the conversation.
 * It DOES NOT authorize actions. Authorization must ALWAYS be performed
 * via `validateAction` / `validateAgentDecision` in `lib/action-validator.ts`.
 */
export function recordToolMessage(
  conversation: Conversation,
  toolMeta: ToolActionMetadata,
  summaryText: string
): { conversation: Conversation; message: ConversationMessage } {
  return addMessage(conversation, {
    role: "tool",
    channel: conversation.channel,
    originalText: summaryText,
    normalizedText: summaryText,
    status: "final",
    toolAction: toolMeta,
  });
}
