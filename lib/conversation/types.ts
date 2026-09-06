import type { VoiceLang } from "@/lib/voice/languages";
import type { SemanticCommandIntent } from "@/lib/voice/types";
import type { PermissionLevel } from "@/lib/copilot/types";

/* ============================================================
   Unified Copilot Conversation Model

   Establishes ONE canonical conversation and message representation
   shared across browser voice, telephone calls, WhatsApp, and
   visual Copilot interactions.

   Key Principles:
   1. ORIGINAL LANGUAGE IS AUTHORITATIVE:
      User utterances in Tamil, Hindi, Kannada, etc. are stored
      faithfully in `originalText`. The visible UI displays `originalText`.
      `normalizedText` stores internal / English translation for reasoning.
   2. CHANNEL NORMALIZATION:
      Interactions over browser_voice, phone, whatsapp, or visual
      map to the same canonical ConversationMessage shape.
   3. SEPARATION OF CONCERNS:
      Conversation RECORDS interaction and audit telemetry.
      Copilot REASONS.
      Tools EXECUTE.
      Action Validator AUTHORIZES.
      The conversation model NEVER authorizes consequential actions.
   ============================================================ */

/**
 * Channels across which Tatkal Copilot interacts with citizens.
 */
export type ConversationChannel =
  | "visual"        // Web UI, wizard, dock typed inputs
  | "browser_voice" // Browser mic + Sarvam audio speech
  | "phone"         // Phone calling (Twilio voice)
  | "whatsapp";     // WhatsApp chat thread

/**
 * Normalized speaker roles.
 */
export type ConversationRole = "user" | "assistant" | "system" | "tool";

/**
 * Lifecycle status of a message.
 */
export type MessageStatus = "interim" | "final" | "error";

/**
 * Audio telemetry and payload metadata when voice is involved.
 */
export interface AudioMetadata {
  present: boolean;
  durationMs?: number;
  codec?: string;
  base64?: string;
  sampleRate?: number;
}

/**
 * Grounded tool and action metadata recorded for auditing and context.
 * NOTE: The conversation model ONLY records tool operations; it NEVER authorizes them.
 */
export interface ToolActionMetadata {
  toolName?: string;
  toolCallId?: string;
  inputs?: Record<string, unknown>;
  result?: unknown;
  permissionLevel?: PermissionLevel; // "informational" | "preparation" | "booking" | "payment"
  isUserInitiated?: boolean;
  requiresConfirmation?: boolean;
  validationResult?: {
    allowed: boolean;
    reason?: string;
    actionType?: string;
  };
}

/**
 * Canonical unit of interaction across all channels.
 */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationRole;
  channel: ConversationChannel;
  /** Spoken or typed transcript in original language (AUTHORITATIVE) */
  originalText: string;
  /** Normalized representation for LLM/tool reasoning (e.g. English translation or cleaned prompt) */
  normalizedText?: string;
  /** Language of original utterance */
  language?: VoiceLang;
  /** Detected language if different from selected */
  detectedLanguage?: string;
  /** Recognition / classification confidence (0 to 1) */
  confidence?: number;
  /** Normalized semantic command intent if utterance is a voice command */
  intent?: SemanticCommandIntent;
  /** Lifecycle status */
  status: MessageStatus;
  /** Optional audio metadata */
  audio?: AudioMetadata;
  /** Optional tool invocation or action record */
  toolAction?: ToolActionMetadata;
  /** ISO timestamp when message was created */
  createdAt: string;
  /** ISO timestamp when message was last updated */
  updatedAt?: string;
}

/**
 * Canonical multi-turn conversation session.
 */
export interface Conversation {
  id: string;
  channel: ConversationChannel;
  messages: ConversationMessage[];
  language?: VoiceLang;
  sessionId?: string;
  tripId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bounded context turn formatted for downstream LLM or agent reasoning.
 */
export interface StructuredContextTurn {
  role: ConversationRole;
  content: string; // resolved based on preference (normalizedText ?? originalText)
  originalText: string;
  language?: VoiceLang;
  intent?: SemanticCommandIntent;
  timestamp: string;
}

/**
 * Bounded context window formatted for downstream LLM or agent reasoning.
 */
export interface ConversationContext {
  conversationId: string;
  channel: ConversationChannel;
  language?: VoiceLang;
  turns: StructuredContextTurn[];
  totalMessagesCount: number;
}
