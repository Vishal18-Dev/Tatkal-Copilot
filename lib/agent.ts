import type { AgentState, NotificationChannel, Trip } from "@/types";

/* ============================================================
   Tatkal Agent — a small but real state machine that drives
   Mission Control over time. Deterministic and repeatable so
   the "Fast-forward" demo clock always tells the same story.
   ============================================================ */

export type AgentStatusKind =
  | "watching"
  | "waiting"
  | "action"
  | "booking"
  | "confirmed"
  | "terminal";

export interface AgentEvent {
  /** Activity-log entry. */
  activity?: { kind: import("@/types").ActivityKind; text: string };
  /** Simulated notifications fired on entering this beat. */
  notifications?: { channel: NotificationChannel; title: string; body: string }[];
}

export interface Beat {
  state: AgentState;
  /** Big countdown label. */
  countdown: string;
  windowOpen: boolean;
}

/** The pre-booking lifecycle the Fast-forward clock walks through. */
export const PRE_BOOKING_STATES: AgentState[] = [
  "scheduled",
  "t_minus_30",
  "t_minus_10",
  "window_open",
  "user_action_required",
];

export function beatFor(state: AgentState): Beat {
  switch (state) {
    case "scheduled":
    case "ready":
    case "draft":
    case "waiting":
      return { state, countdown: "10:00 AM", windowOpen: false };
    case "t_minus_30":
      return { state, countdown: "30:00", windowOpen: false };
    case "t_minus_10":
      return { state, countdown: "10:00", windowOpen: false };
    case "window_open":
    case "user_action_required":
      return { state, countdown: "00:00", windowOpen: true };
    case "booking_in_progress":
    case "primary_failed":
    case "backup_recommended":
    case "backup_attempt":
      return { state, countdown: "LIVE", windowOpen: true };
    case "confirmed":
      return { state, countdown: "DONE", windowOpen: true };
    default:
      return { state, countdown: "—", windowOpen: false };
  }
}

/** Next state when the demo clock fast-forwards (pre-booking only). */
export function nextPreBookingState(state: AgentState): AgentState | null {
  const i = PRE_BOOKING_STATES.indexOf(state);
  if (i === -1) {
    // Not yet in the lifecycle → start it.
    return "scheduled";
  }
  return PRE_BOOKING_STATES[i + 1] ?? null;
}

/** Events emitted when the agent enters a given state (fired once). */
export function eventsFor(state: AgentState, plan: Trip): AgentEvent {
  const primary = plan.primary.trainName;
  const backup = plan.backup?.trainName ?? "your backup";
  switch (state) {
    case "scheduled":
      return {
        activity: { kind: "strategy_change", text: "Tatkal reminder scheduled" },
        notifications: [
          { channel: "in-app", title: "Your Tatkal plan is ready", body: `${plan.from} → ${plan.to}. I'll watch the clock and remind you before Tatkal opens.` },
        ],
      };
    case "t_minus_30":
      return {
        activity: { kind: "attempt_started", text: "Readiness check completed · 5/6 items ready" },
        notifications: [
          { channel: "push", title: "Tatkal opens in 30 minutes", body: `Your passengers and backup (${backup}) are already prepared.` },
        ],
      };
    case "t_minus_10":
      return {
        notifications: [
          { channel: "push", title: "Tatkal opens in 10 minutes", body: "Keep IRCTC / the authorized booking channel ready." },
        ],
      };
    case "window_open":
      return {
        activity: { kind: "attempt_started", text: "Tatkal window opened" },
        notifications: [
          { channel: "push", title: "Tatkal is now open", body: `Your selected strategy (${primary}) is ready to execute.` },
        ],
      };
    case "user_action_required":
      return {
        activity: { kind: "strategy_change", text: "You hadn't opened your plan — reminders sent" },
        notifications: [
          { channel: "whatsapp", title: "Reminder sent via WhatsApp", body: `Tatkal is open for ${plan.from} → ${plan.to}. Open your plan to book.` },
          { channel: "email", title: "Email reminder sent", body: "Your Tatkal booking window is open." },
        ],
      };
    case "confirmed":
      return {
        activity: { kind: "confirmed", text: "Booking simulated successfully" },
        notifications: [
          { channel: "push", title: "Ticket confirmed (demo)", body: `Confirmed on ${plan.booking?.finalTrainName ?? backup}.` },
        ],
      };
    default:
      return {};
  }
}

export function statusMeta(state: AgentState): {
  label: string;
  labelKey: string;
  kind: AgentStatusKind;
  dot: string;
} {
  switch (state) {
    case "draft":
    case "ready":
    case "scheduled":
      return { label: "Watching your journey", labelKey: "status.watchingJourney", kind: "watching", dot: "bg-confirm" };
    case "waiting":
    case "t_minus_30":
    case "t_minus_10":
      return { label: "Waiting for Tatkal window", labelKey: "status.waitingWindow", kind: "waiting", dot: "bg-brand" };
    case "window_open":
    case "user_action_required":
    case "backup_recommended":
    case "primary_failed":
      return { label: "Action required", labelKey: "status.actionRequired", kind: "action", dot: "bg-caution" };
    case "booking_in_progress":
    case "backup_attempt":
      return { label: "Booking in progress", labelKey: "status.bookingInProgress", kind: "booking", dot: "bg-brand" };
    case "confirmed":
      return { label: "Confirmed", labelKey: "status.confirmed", kind: "confirmed", dot: "bg-confirm" };
    case "expired":
      return { label: "Window expired", labelKey: "status.actionRequired", kind: "terminal", dot: "bg-danger" };
    case "cancelled":
      return { label: "Cancelled", labelKey: "status.confirmed", kind: "terminal", dot: "bg-ink-faint" };
    default:
      return { label: "Watching", labelKey: "status.watching", kind: "watching", dot: "bg-confirm" };
  }
}

export function coachFor(state: AgentState, plan: Trip): string {
  const primary = plan.primary.trainName;
  const backup = plan.backup?.trainName;
  const via = plan.backup?.via;
  switch (state) {
    case "scheduled":
    case "ready":
    case "draft":
      return `Your plan is ready. I'll watch the clock and prepare everything — you don't need to keep the app open.`;
    case "t_minus_30":
      return `Tatkal opens in 30 minutes. Your passengers and backup strategy are already prepared. Nothing to do yet.`;
    case "t_minus_10":
      return `Ten minutes to go. Keep your payment app and the authorized booking channel ready — I'll tell you the moment it opens.`;
    case "window_open":
      return `Tatkal is open. Start with ${primary}. I'm holding ${backup ?? "your backup"} ready in case it doesn't confirm.`;
    case "user_action_required":
      return `The window is open and you haven't started yet. Don't rush the search — your plan is prepared. Tap Start booking.`;
    case "booking_in_progress":
      return `Attempting ${primary} now. Stay put — I'll switch to your backup instantly if the quota runs out.`;
    case "primary_failed":
    case "backup_recommended":
      return `${primary} is no longer available. Don't restart the search${via ? ` — your backup via ${via} is ready` : ""}. Tap Use backup.`;
    case "backup_attempt":
      return `Booking ${backup ?? "your backup"} now.`;
    case "confirmed":
      return `Done. ${plan.booking?.recovered ? "Your backup secured the seat — that's exactly why it mattered." : "Confirmed on your first choice."}`;
    default:
      return `I'm keeping watch over this journey.`;
  }
}

/** Readiness checklist for a plan given its agent state. */
export interface ReadinessItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
}

export function readinessFor(plan: Trip): ReadinessItem[] {
  const past = (s: AgentState) =>
    lifecycleIndex(plan.agentState) >= lifecycleIndex(s);
  return [
    { id: "travellers", label: "Passengers ready", hint: "Pulled from your Travellers.", done: plan.travellerIds.length > 0 },
    { id: "train", label: "Train selected", hint: `${plan.primary.trainName} · ${plan.primary.travelClass}`, done: true },
    { id: "backup", label: "Backup strategy ready", hint: plan.backup ? plan.backup.trainName : "None available", done: !!plan.backup },
    { id: "boarding", label: "Boarding station confirmed", hint: `Board at ${plan.primary.boardingStationName}`, done: true },
    { id: "session", label: "Railway booking session ready", hint: "Keep the authorized channel open.", done: past("t_minus_10") },
    { id: "device", label: "Phone & internet ready", hint: "A dropped connection loses your slot.", done: true },
  ];
}

const LIFECYCLE: AgentState[] = [
  "draft",
  "ready",
  "scheduled",
  "waiting",
  "t_minus_30",
  "t_minus_10",
  "window_open",
  "user_action_required",
  "booking_in_progress",
  "primary_failed",
  "backup_recommended",
  "backup_attempt",
  "confirmed",
];
function lifecycleIndex(s: AgentState): number {
  const i = LIFECYCLE.indexOf(s);
  return i === -1 ? -1 : i;
}

/** Short status word for trip cards. */
export function tripStatusWord(state: AgentState): {
  key: string;
  tone: "confirm" | "brand" | "caution" | "neutral";
} {
  const m = statusMeta(state);
  if (state === "confirmed") return { key: "status.confirmed", tone: "confirm" };
  if (m.kind === "action") return { key: "status.bookingRequired", tone: "caution" };
  if (m.kind === "waiting") return { key: "status.ready", tone: "brand" };
  if (m.kind === "booking") return { key: "status.booking", tone: "brand" };
  return { key: "status.watching", tone: "confirm" };
}
