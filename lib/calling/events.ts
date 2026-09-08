/* ============================================================
   Calling Events & Milestone Dispatcher
   Coordinates event emission and evaluates whether a milestone
   warrants an outbound proactive call or a UI update only.
   ============================================================ */

export type CallingEventType =
  | "BOOKING_BRIEFING_DUE"
  | "BOOKING_WINDOW_OPEN"
  | "PRIMARY_BOOKING_FAILED"
  | "BACKUP_BOOKING_FAILED"
  | "BACKUP_BOOKING_CONFIRMED"
  | "PREMIUM_TATKAL_ACTIVATED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_FAILED"
  | "AUTHORIZATION_REQUIRED"
  | "PAYMENT_REQUIRED";

export interface CallingEventPayload {
  type: CallingEventType;
  tripId?: string;
  trainName?: string;
  backupTrainName?: string;
  quota?: "TQ" | "PT" | "GN";
  fare?: number;
  reason?: string;
  briefingText?: string;
  timestamp?: string;
}

/**
 * The communication policy layer:
 * Only trigger outbound phone/browser calls on meaningful milestones.
 * Internal state transitions update telemetry and Mission Control only.
 */
export function shouldTriggerProactiveCall(event: CallingEventType): boolean {
  switch (event) {
    case "BOOKING_BRIEFING_DUE":
      // T-5 minutes briefing call
      return true;

    case "BACKUP_BOOKING_CONFIRMED":
      // Meaningful recovery milestone
      return true;

    case "BOOKING_CONFIRMED":
      // Final confirmation milestone (e.g. PT or primary outcome)
      return true;

    case "BOOKING_FAILED":
      // Complete exhaustion/failure
      return true;

    case "BOOKING_WINDOW_OPEN":
    case "PRIMARY_BOOKING_FAILED":
    case "BACKUP_BOOKING_FAILED":
    case "PREMIUM_TATKAL_ACTIVATED":
    case "AUTHORIZATION_REQUIRED":
    case "PAYMENT_REQUIRED":
    default:
      // UI / Mission Control updates only
      return false;
  }
}
