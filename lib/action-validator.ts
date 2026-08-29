import type { Trip, NotificationChannel } from "@/types";

/* ============================================================
   Action Validator — Validation layer between OpenAI decision & execution.

   Every decision proposed by OpenAI or local engine MUST pass
   validation before any tool call executes or mutates state.
   ============================================================ */

export type AllowedAgentAction =
  | "none"
  | "notify_user"
  | "open_booking_flow"
  | "evaluate_backup"
  | "activate_backup";

export type AllowedAgentTool =
  | "notifyUser"
  | "openBookingFlow"
  | "activateBackupStrategy"
  | "recordEvent";

export interface AgentToolCallProposal {
  name: AllowedAgentTool;
  arguments?: {
    channel?: NotificationChannel;
    title?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface ProposedAgentDecision {
  action: AllowedAgentAction;
  reason: string;
  toolCall?: AgentToolCallProposal;
  source: "gpt" | "gemini" | "local";
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
  code: "ok" | "disallowed_action" | "disallowed_tool" | "missing_backup" | "duplicate_notification" | "invalid_args" | "already_completed";
}

export function validateAgentDecision(
  decision: ProposedAgentDecision,
  trip: Trip,
  sentNotificationKeys: Set<string>,
  isUserInitiated?: boolean
): ValidationResult {
  const ALLOWED_ACTIONS: AllowedAgentAction[] = [
    "none",
    "notify_user",
    "open_booking_flow",
    "evaluate_backup",
    "activate_backup",
  ];

  const ALLOWED_TOOLS: AllowedAgentTool[] = [
    "notifyUser",
    "openBookingFlow",
    "activateBackupStrategy",
    "recordEvent",
  ];

  // 1. Validate action enum
  if (!ALLOWED_ACTIONS.includes(decision.action)) {
    return {
      valid: false,
      reason: `Action '${decision.action}' is not in the allowed action set`,
      code: "disallowed_action",
    };
  }

  // 2. Validate tool call if present
  if (decision.toolCall) {
    if (!ALLOWED_TOOLS.includes(decision.toolCall.name)) {
      return {
        valid: false,
        reason: `Tool '${decision.toolCall.name}' is not a registered agent tool`,
        code: "disallowed_tool",
      };
    }
  }

  // 3. Action-specific validation rules & mode boundaries
  switch (decision.action) {
    case "notify_user": {
      const channel = decision.toolCall?.arguments?.channel;
      const title = decision.toolCall?.arguments?.title || "Tatkal Copilot";
      const notifKey = decision.toolCall?.arguments?.notificationKey as string | undefined;

      const keysToCheck = [
        notifKey ? `key:${notifKey}` : null,
        channel ? `${channel}:${title}` : null,
        title ? `title:${title}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToCheck) {
        if (sentNotificationKeys.has(k)) {
          return {
            valid: false,
            reason: `Notification suppressed — identical notification (${k}) already sent`,
            code: "duplicate_notification",
          };
        }
      }
      return { valid: true, reason: "Notification validated", code: "ok" };
    }

    case "activate_backup": {
      if (!trip.backup) {
        return {
          valid: false,
          reason: "Cannot activate backup: No backup strategy was prepared for this trip",
          code: "missing_backup",
        };
      }
      if (trip.mode === "assisted" && !isUserInitiated) {
        return {
          valid: false,
          reason: "Assisted mode requires explicit user authorization to activate backup strategy",
          code: "disallowed_action",
        };
      }
      if (trip.agentState === "confirmed") {
        return {
          valid: false,
          reason: "Cannot activate backup: Booking is already confirmed",
          code: "already_completed",
        };
      }
      return { valid: true, reason: "Backup activation validated", code: "ok" };
    }

    case "open_booking_flow": {
      if (trip.mode === "assisted" && !isUserInitiated) {
        return {
          valid: false,
          reason: "Assisted mode requires explicit user initiation to start booking",
          code: "disallowed_action",
        };
      }
      if (trip.agentState === "confirmed") {
        return {
          valid: false,
          reason: "Cannot open booking flow: Ticket is already confirmed",
          code: "already_completed",
        };
      }
      if (trip.agentState === "booking_in_progress" || trip.agentState === "backup_attempt") {
        return {
          valid: false,
          reason: "Cannot open booking flow: Booking is already in progress",
          code: "already_completed",
        };
      }
      return { valid: true, reason: "Booking flow validated", code: "ok" };
    }

    case "none":
    case "evaluate_backup":
    default:
      return { valid: true, reason: "Decision validated", code: "ok" };
  }
}
