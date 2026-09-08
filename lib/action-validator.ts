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
  | "activate_backup"
  | "evaluate_strategy"
  | "switch_to_premium_tatkal";

export type AllowedAgentTool =
  | "notifyUser"
  | "openBookingFlow"
  | "activateBackupStrategy"
  | "recordEvent"
  | "evaluateStrategy"
  | "switchToPremiumTatkal";

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
    "evaluate_strategy",
    "switch_to_premium_tatkal",
  ];

  const ALLOWED_TOOLS: AllowedAgentTool[] = [
    "notifyUser",
    "openBookingFlow",
    "activateBackupStrategy",
    "recordEvent",
    "evaluateStrategy",
    "switchToPremiumTatkal",
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

    case "switch_to_premium_tatkal": {
      if (trip.agentState === "confirmed") {
        return {
          valid: false,
          reason: "Cannot switch to Premium Tatkal: Booking is already confirmed",
          code: "already_completed",
        };
      }
      if (trip.agentState === "booking_in_progress" || trip.agentState === "backup_attempt") {
        return {
          valid: false,
          reason: "Cannot switch to Premium Tatkal: Booking is already in progress",
          code: "already_completed",
        };
      }

      const args = decision.toolCall?.arguments ?? {};
      const fare = typeof args.fare === "number" ? args.fare : (typeof args.amount === "number" ? args.amount : null);
      const availability = args.availability as string | undefined;
      const maxFare = typeof args.maxFare === "number" ? args.maxFare : (trip as any).userConstraints?.maxFare;
      const maxPtFare = typeof args.maxPremiumTatkalFare === "number"
        ? args.maxPremiumTatkalFare
        : (trip as any).userConstraints?.maxPremiumTatkalFare;
      const excludedQuotas =
        (trip as any).userConstraints?.excludedQuotas ||
        (args.excludedQuotas as string[] | undefined) ||
        (args.prohibitedQuotas as string[] | undefined);

      // Check explicit user prohibition
      if (excludedQuotas?.includes("PT")) {
        return {
          valid: false,
          reason: "Action blocked: User explicitly prohibited Premium Tatkal",
          code: "disallowed_action",
        };
      }

      // Check unknown live data
      if (availability === "UNKNOWN") {
        return {
          valid: false,
          reason: "Action blocked: Cannot execute Premium Tatkal booking with unknown availability",
          code: "disallowed_action",
        };
      }

      if (fare === null || fare === undefined) {
        return {
          valid: false,
          reason: "Action blocked: Cannot execute Premium Tatkal booking with unknown fare",
          code: "disallowed_action",
        };
      }

      // Check fare ceiling: maxFare (for any strategy)
      if (maxFare !== undefined && fare > maxFare) {
        return {
          valid: false,
          reason: `Action blocked: Premium Tatkal fare of ₹${fare} exceeds maximum fare limit of ₹${maxFare}`,
          code: "disallowed_action",
        };
      }

      // Check PT specific fare ceiling: maxPremiumTatkalFare
      if (maxPtFare !== undefined && fare > maxPtFare) {
        return {
          valid: false,
          reason: `Action blocked: Premium Tatkal fare of ₹${fare} exceeds Premium Tatkal limit of ₹${maxPtFare}`,
          code: "disallowed_action",
        };
      }

      // Check assisted mode boundary
      if (trip.mode === "assisted" && !isUserInitiated) {
        return {
          valid: false,
          reason: "Assisted mode requires explicit user authorization to switch to Premium Tatkal",
          code: "disallowed_action",
        };
      }

      return { valid: true, reason: "Premium Tatkal switch validated", code: "ok" };
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

    case "evaluate_strategy":
    case "none":
    case "evaluate_backup":
    default:
      return { valid: true, reason: "Decision validated", code: "ok" };
  }
}
