import type { Trip, AgentState } from "@/types";

export type ReadinessCheckId =
  | "passengers"
  | "train"
  | "backup"
  | "boarding"
  | "booking_session"
  | "connectivity";

export type ReadinessCheckCategory = "critical" | "operational";
export type ReadinessStatus = "ready" | "not_ready";

export interface ReadinessCheck {
  id: ReadinessCheckId;
  label: string;
  category: ReadinessCheckCategory;
  status: ReadinessStatus;
  reason: string;
  explanation: string;
  hint: string;
  done: boolean;
}

export interface DetailedReadiness {
  readyCount: number;
  totalCount: number;
  isReady: boolean;
  criticalReady: boolean;
  summary: string;
  checks: ReadinessCheck[];
  blockingIds: ReadinessCheckId[];
  missingIds: ReadinessCheckId[];
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

/**
 * Deterministic Readiness Engine.
 * Evaluates actual application state into structured readiness checks.
 * NEVER asks an LLM to calculate readiness scores.
 */
export function calculateReadiness(trip: Trip): DetailedReadiness {
  const past = (s: AgentState) => lifecycleIndex(trip.agentState) >= lifecycleIndex(s);

  // 1. Passengers ready (Critical)
  const passengerCount = trip.travellerIds?.length ?? 0;
  const passengersReady = passengerCount > 0;

  // 2. Primary Train selected (Critical)
  const trainReady = !!(trip.primary && trip.primary.trainName);

  // 3. Backup strategy ready (Operational)
  const backupReady = !!(trip.backup && trip.backup.trainName);

  // 4. Boarding station confirmed (Critical)
  const boardingReady = !!(trip.primary && trip.primary.boardingStationName);

  // 5. Railway booking session ready (Critical)
  const sessionReady = past("t_minus_10") || trip.agentEnabled || trip.mode === "auto" || trip.readinessDone?.includes("authorized");

  // 6. Phone & internet ready (Operational)
  const connectivityReady = true;

  const checks: ReadinessCheck[] = [
    {
      id: "passengers",
      label: "Passengers ready",
      category: "critical",
      status: passengersReady ? "ready" : "not_ready",
      done: passengersReady,
      reason: passengersReady
        ? `${passengerCount} passenger${passengerCount > 1 ? "s" : ""} prepared with required details`
        : "No passengers selected for this journey",
      explanation: "Required traveller details (name, age, berth preference) are stored and ready for instant form submission when the booking window opens.",
      hint: passengersReady ? `${passengerCount} passenger${passengerCount > 1 ? "s" : ""} ready` : "Add at least 1 traveller",
    },
    {
      id: "train",
      label: "Train selected",
      category: "critical",
      status: trainReady ? "ready" : "not_ready",
      done: trainReady,
      reason: trainReady
        ? `Primary strategy selected: ${trip.primary.trainName}`
        : "No primary train or strategy selected",
      explanation: "A primary train option and travel class must be selected so Copilot knows where to direct the booking attempt.",
      hint: trainReady ? `${trip.primary.trainName} · ${trip.primary.travelClass}` : "Select primary train",
    },
    {
      id: "backup",
      label: "Backup strategy ready",
      category: "operational",
      status: backupReady ? "ready" : "not_ready",
      done: backupReady,
      reason: backupReady
        ? `Backup strategy configured: ${trip.backup?.trainName}`
        : "No backup strategy configured",
      explanation: "No alternate strategy is configured. A backup strategy provides instant recovery if Tatkal quota runs out on your primary train.",
      hint: backupReady ? (trip.backup?.trainName ?? "Backup ready") : "No backup selected",
    },
    {
      id: "boarding",
      label: "Boarding station confirmed",
      category: "critical",
      status: boardingReady ? "ready" : "not_ready",
      done: boardingReady,
      reason: boardingReady
        ? `Boarding station confirmed: ${trip.primary.boardingStationName}`
        : "Boarding station missing",
      explanation: "The boarding station determines Tatkal quota rules and train departure timing.",
      hint: boardingReady ? `Board at ${trip.primary.boardingStationName}` : "Confirm boarding point",
    },
    {
      id: "booking_session",
      label: "Railway booking session ready",
      category: "critical",
      status: sessionReady ? "ready" : "not_ready",
      done: sessionReady,
      reason: sessionReady
        ? "Authorized railway booking channel permissioned & ready"
        : "Authorized railway booking channel is not ready",
      explanation: "Copilot needs an authorized booking channel before it can enter the booking flow. This demo environment uses a permissioned railway provider.",
      hint: sessionReady ? "Channel permissioned & ready" : "Authorize booking channel",
    },
    {
      id: "connectivity",
      label: "Phone & internet ready",
      category: "operational",
      status: connectivityReady ? "ready" : "not_ready",
      done: connectivityReady,
      reason: "System & network connectivity requirement satisfied (simulated)",
      explanation: "Active network connection required to send and receive real-time booking alerts and state updates.",
      hint: "Simulated device & internet check",
    },
  ];

  const readyCount = checks.filter((c) => c.status === "ready").length;
  const totalCount = checks.length;
  const isReady = readyCount === totalCount;

  const blockingIds = checks.filter((c) => c.category === "critical" && c.status === "not_ready").map((c) => c.id);
  const missingIds = checks.filter((c) => c.status === "not_ready").map((c) => c.id);
  const criticalReady = blockingIds.length === 0;

  let summary = "Ready to act";
  if (readyCount < totalCount) {
    const unreadyCount = totalCount - readyCount;
    if (blockingIds.length > 0) {
      summary = `${blockingIds.length} critical item${blockingIds.length > 1 ? "s" : ""} ${blockingIds.length > 1 ? "need" : "needs"} attention`;
    } else {
      summary = `${unreadyCount} operational item${unreadyCount > 1 ? "s" : ""} ${unreadyCount > 1 ? "need" : "needs"} attention`;
    }
  }

  return {
    readyCount,
    totalCount,
    isReady,
    criticalReady,
    summary,
    checks,
    blockingIds,
    missingIds,
  };
}
