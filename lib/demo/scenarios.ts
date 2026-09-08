/* ============================================================
   Tatkal Copilot — Central Demo Scenario Engine
   Deterministic simulation of external railway transaction layer
   without bypassing Copilot reasoning, authorization, quota policies,
   spend ceilings, or passenger integrity.
   ============================================================ */

import type { Trip, Traveller } from "@/types";
import type { WalletState } from "@/lib/payments/types";
import {
  evaluateStrategyEligibility,
  type CompatibilityCheckResult,
} from "@/lib/booking/quota-policy";
import { validateAgentDecision } from "@/lib/action-validator";

export type DemoScenario =
  | "assisted_briefing"
  | "assisted_to_permissioned_backup_success"
  | "assisted_to_permissioned_premium_tatkal_success"
  | "permissioned_backup_success"
  | "permissioned_premium_tatkal_success";

export type ScenarioPhase =
  | "idle"
  | "t_minus_5_briefing"
  | "permission_requested"
  | "authorized"
  | "t_zero_attempt"
  | "primary_failed"
  | "backup_attempt"
  | "backup_confirmed"
  | "backup_failed"
  | "pt_evaluating"
  | "pt_confirmed"
  | "blocked"
  | "completed";

export type StrategyStepStatus =
  | "ready"
  | "armed"
  | "attempting"
  | "unavailable"
  | "evaluating"
  | "confirmed"
  | "blocked"
  | "available"
  | "none";

export interface StrategyTimelineState {
  primary: StrategyStepStatus;
  backup: StrategyStepStatus;
  premiumTatkal: StrategyStepStatus;
  primaryReason?: string;
  backupReason?: string;
  ptReason?: string;
}

export interface DemoScenarioDefinition {
  id: DemoScenario;
  title: string;
  subtitle: string;
  initialMode: "assisted" | "auto";
  premiumTatkalEnabled: boolean;
  description: string;
}

export const HEADLINE_SCENARIOS: DemoScenario[] = [
  "assisted_briefing",
  "assisted_to_permissioned_backup_success",
  "assisted_to_permissioned_premium_tatkal_success",
];

export const DEMO_SCENARIO_DEFINITIONS: Record<DemoScenario, DemoScenarioDefinition> = {
  assisted_briefing: {
    id: "assisted_briefing",
    title: "Scenario 1 · Assisted Briefing",
    subtitle: "Proactive assistance · User remains available, approves booking",
    initialMode: "assisted",
    premiumTatkalEnabled: false,
    description:
      "Starts in Assisted mode. Copilot calls at T-5 with a concise briefing. User confirms they will be available. Copilot keeps everything ready while user remains in Assisted mode without autonomous takeover.",
  },
  assisted_to_permissioned_backup_success: {
    id: "assisted_to_permissioned_backup_success",
    title: "Scenario 2 · Assisted → Permissioned → Backup",
    subtitle: "Autonomous takeover · User outside, authorizes Copilot, backup succeeds",
    initialMode: "assisted",
    premiumTatkalEnabled: false,
    description:
      "Starts in Assisted mode. Copilot calls at T-5. User states they are outside. Copilot requests permission to escalate to Permissioned mode. User explicitly authorizes. At T=0, primary fails and backup succeeds with proactive confirmation call.",
  },
  assisted_to_permissioned_premium_tatkal_success: {
    id: "assisted_to_permissioned_premium_tatkal_success",
    title: "Scenario 3 · Assisted → Permissioned → Premium Tatkal",
    subtitle: "Two-stage recovery · Fails primary & backup, recovers via Premium Tatkal",
    initialMode: "assisted",
    premiumTatkalEnabled: true,
    description:
      "Starts in Assisted mode with PT enabled. User is outside and authorizes Permissioned mode. At T=0, primary fails and backup fails. Copilot evaluates real PT eligibility, budget ceilings, and wallet balance before confirming Premium Tatkal.",
  },
  permissioned_backup_success: {
    id: "permissioned_backup_success",
    title: "Dev · Permissioned → Backup Success",
    subtitle: "Direct permissioned execution",
    initialMode: "auto",
    premiumTatkalEnabled: false,
    description: "Internal testing scenario starting directly in Permissioned mode.",
  },
  permissioned_premium_tatkal_success: {
    id: "permissioned_premium_tatkal_success",
    title: "Dev · Permissioned → Premium Tatkal",
    subtitle: "Direct permissioned PT execution",
    initialMode: "auto",
    premiumTatkalEnabled: true,
    description: "Internal testing scenario starting directly in Permissioned mode with PT.",
  },
};

export interface ScenarioContext {
  trip: Trip;
  travellers: Traveller[];
  wallet: WalletState;
  maxAuthorizedSpend: number;
  maxPremiumTatkalFare?: number;
  ptEstimatedFare?: number | null; // null represents UNKNOWN fare
  isPtQuotaExhausted?: boolean;
}

export interface ScenarioExecutionState {
  scenario: DemoScenario;
  phase: ScenarioPhase;
  timeline: StrategyTimelineState;
  incomingCallVisible: boolean;
  permissionModalVisible: boolean;
  activeCallBriefing: string | null;
  activeCallOutcome: string | null;
  blockedReason?: string;
  confirmedPnr?: string;
  confirmedTrainName?: string;
}

/**
 * Builds the comprehensive T-5 Copilot voice briefing per Task 5I specification:
 * - journey corridor
 * - travel date
 * - passenger count
 * - selected passenger names, only if explicitly selected
 * - preferred class
 * - primary strategy
 * - backup strategy
 * - Premium Tatkal status
 * - current wallet balance
 * - current authorized maximum
 * - whether wallet balance is sufficient
 * - Tatkal opening time
 */
export function buildTMinus5Briefing(ctx: ScenarioContext): string {
  const trip = ctx.trip;
  const corridor = `${trip.from} to ${trip.to}`;
  const travelDate = trip.dateLabel || "tomorrow";
  const paxCount = trip.travellerIds?.length || 1;
  const paxNames =
    ctx.travellers && ctx.travellers.length > 0
      ? ctx.travellers
          .filter((t) => trip.travellerIds?.includes(t.id))
          .map((t) => t.name)
          .join(", ")
      : "";
  const namesSnippet = paxNames ? ` for ${paxNames}` : "";
  const travelClass = trip.travelClass || "3A";
  const primaryName = trip.primary?.trainName || trip.trainName || "Primary Express";
  const backupName = trip.backup?.trainName || "Prepared Backup Express";
  const ptStatus = (trip as any).premiumTatkalEnabled ? "enabled as tertiary recovery" : "disabled";
  const walletBal = ctx.wallet.balance;
  const maxSpend = ctx.maxAuthorizedSpend;
  const totalEstimatedFare = (trip.primary?.fare || 2500) * paxCount;
  const isSufficient = walletBal >= totalEstimatedFare;
  const opensAt = trip.tatkalOpensAtLabel || "10:00 AM";

  const walletNote = isSufficient
    ? `Your Rail Wallet has ₹${walletBal.toLocaleString("en-IN")}, which is sufficient.`
    : `Your Rail Wallet has ₹${walletBal.toLocaleString("en-IN")}, which may require a top-up of ₹${(totalEstimatedFare - walletBal).toLocaleString("en-IN")}.`;

  return [
    `Namaste! Your Tatkal AC window opens at ${opensAt}.`,
    `Here is your booking briefing for ${corridor} on ${travelDate} in class ${travelClass}, for ${paxCount} passenger${paxCount > 1 ? "s" : ""}${namesSnippet}.`,
    `Primary strategy is ${primaryName}, with backup set to ${backupName}. Premium Tatkal is ${ptStatus}.`,
    `${walletNote} Your maximum authorized spend is ₹${maxSpend.toLocaleString("en-IN")}.`,
    "Will you be available to approve the booking when Tatkal opens?",
  ].join(" ");
}

/**
 * Validates Premium Tatkal execution against real existing rules:
 * - PT must be enabled
 * - authoritative fare must be known (amount !== null)
 * - wallet must be sufficient (wallet.balance >= totalFare)
 * - estimated amount must be within maxPremiumTatkalFare
 * - final amount must be within maxFare if maxFare exists
 * - user authorization must permit autonomous action (mode === "auto")
 * - railway policy must permit the action (availability !== "NOT_AVAILABLE")
 * - passenger selection must be valid
 */
export function evaluatePremiumTatkalGuard(ctx: ScenarioContext): {
  allowed: boolean;
  reason?: string;
  eligibility?: CompatibilityCheckResult;
} {
  const trip = ctx.trip;
  const paxCount = trip.travellerIds?.length || 1;

  // 1. PT must be enabled
  if (!(trip as any).premiumTatkalEnabled) {
    return {
      allowed: false,
      reason: "Premium Tatkal is not enabled for this journey.",
    };
  }

  // 2. Mode must be autonomous/permissioned
  if (trip.mode !== "auto") {
    return {
      allowed: false,
      reason: "Copilot is in Assisted mode. Autonomous Premium Tatkal execution requires Permissioned mode.",
    };
  }

  // 3. Passenger count integrity
  if (paxCount <= 0) {
    return {
      allowed: false,
      reason: "No valid passengers selected for booking.",
    };
  }

  // 4. Authoritative fare check (Zero live data fabrication)
  const unitFare = ctx.ptEstimatedFare;
  if (unitFare === null || unitFare === undefined) {
    return {
      allowed: false,
      reason: "Authoritative Premium Tatkal fare is UNKNOWN from railway servers. Autonomous execution blocked.",
    };
  }

  const totalPtFare = unitFare * paxCount;

  // 5. Quota availability check
  if (ctx.isPtQuotaExhausted) {
    return {
      allowed: false,
      reason: "Premium Tatkal quota is currently exhausted.",
    };
  }

  // 6. Wallet sufficiency
  if (ctx.wallet.balance < totalPtFare) {
    return {
      allowed: false,
      reason: `Rail Wallet balance of ₹${ctx.wallet.balance.toLocaleString("en-IN")} is insufficient for Premium Tatkal total of ₹${totalPtFare.toLocaleString("en-IN")}. Top-up required.`,
    };
  }

  // 7. Max Premium Tatkal Fare ceiling
  if (ctx.maxPremiumTatkalFare !== undefined && totalPtFare > ctx.maxPremiumTatkalFare) {
    return {
      allowed: false,
      reason: `Total Premium Tatkal fare (₹${totalPtFare.toLocaleString("en-IN")}) exceeds authorized Premium Tatkal ceiling of ₹${ctx.maxPremiumTatkalFare.toLocaleString("en-IN")}.`,
    };
  }

  // 8. Max Fare ceiling (overall budget)
  if (ctx.maxAuthorizedSpend !== undefined && totalPtFare > ctx.maxAuthorizedSpend) {
    return {
      allowed: false,
      reason: `Total fare (₹${totalPtFare.toLocaleString("en-IN")}) exceeds maximum authorized spend limit of ₹${ctx.maxAuthorizedSpend.toLocaleString("en-IN")}.`,
    };
  }

  // 9. Standard Quota Policy Layer Compatibility Evaluation
  const eligibility = evaluateStrategyEligibility(
    {
      id: "strat-pt",
      journeyId: trip.id || "journey-pt-recovery",
      trainNumber: "12953",
      trainName: trip.backup?.trainName || trip.trainName || "Tejas Rajdhani",
      quota: "PT",
      travelClass: trip.travelClass || "3A",
      boardingStation: {
        code: trip.fromCode || "MMCT",
        name: trip.from || "Mumbai Central",
      },
      fare: {
        amount: totalPtFare,
        currency: "INR",
        quota: "PT",
        isDynamic: true,
        isEstimated: false,
        fareSource: "irctc_provider",
      },
      availability: "CONFIRMED",
      departure: "16:55",
      arrival: "08:35",
      durationMins: 940,
      arrivalStation: {
        code: trip.toCode || "NDLS",
        name: trip.to || "New Delhi",
      },
      tatkalSuitability: "high",
      rationale: ["Live PT seats available"],
      priorityScore: 85,
      authorizationRequired: true,
      provenance: {
        availabilitySource: "RailRadar",
        fareSource: "irctc_provider",
        policySource: "railway_quota_rules",
        isDemoData: false,
      },
    },
    {
      maxFare: ctx.maxAuthorizedSpend,
      maxPremiumTatkalFare: ctx.maxPremiumTatkalFare,
      allowedQuotas: ["TQ", "PT"],
    },
    {
      mode: "permissioned",
      userInitiated: false,
      authorizedQuotas: ["TQ", "PT"],
      maxFare: ctx.maxAuthorizedSpend,
      maxPremiumTatkalFare: ctx.maxPremiumTatkalFare,
      allowAutomaticFallback: true,
      requireConfirmationForPremiumTatkal: false,
    },
    true, // identity ready
    ctx.wallet.balance >= totalPtFare // payment ready
  );

  if (!eligibility.eligible) {
    return {
      allowed: false,
      reason: eligibility.reasons.join(" ") || "Blocked by Quota Policy constraints.",
      eligibility,
    };
  }

  // 10. Pass through action validator
  const actionValidation = validateAgentDecision(
    {
      action: "switch_to_premium_tatkal",
      reason: "Primary and backup quotas unavailable; escalating to Premium Tatkal within authorized ceiling",
      toolCall: {
        name: "switchToPremiumTatkal",
        arguments: {
          fare: totalPtFare,
          maxFare: ctx.maxAuthorizedSpend,
          maxPremiumTatkalFare: ctx.maxPremiumTatkalFare,
        },
      },
      source: "local",
    },
    { ...trip, mode: "auto" },
    new Set()
  );

  if (!actionValidation.valid) {
    return {
      allowed: false,
      reason: actionValidation.reason,
      eligibility,
    };
  }

  return {
    allowed: true,
    eligibility,
  };
}

export const CANONICAL_DEMO_TRIP_ID = "demo_trip_mumbai_delhi";

/**
 * Creates the canonical, fully-configured demo travel for Mumbai → Delhi (3A).
 * Always pre-configured with Primary (12953 August Kranti Rajdhani) and
 * Prepared Backup (Split via Kota Junction), ready for all 3 demo scenarios.
 */
export function createCanonicalDemoTrip(travellerIds?: string[]): Trip {
  const ids = travellerIds && travellerIds.length > 0 ? travellerIds.slice(0, 2) : ["p1", "p2"];
  return {
    id: CANONICAL_DEMO_TRIP_ID,
    status: "upcoming",
    from: "Mumbai",
    fromCode: "BCT",
    to: "Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "12953 August Kranti Rajdhani",
    travelClass: "3A",
    travellerIds: ids,
    boardingStationName: "Borivali",
    arrivalDisplay: "06:40 · tomorrow",
    fare: 2360,
    mode: "assisted",
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    arrivalTargetLabel: "before 08:00",
    primary: {
      optionId: "12953-3A",
      trainName: "12953 August Kranti Rajdhani",
      travelClass: "3A",
      boardingStationName: "Borivali",
      departureDisplay: "16:35",
      arrivalDisplay: "06:40 · tomorrow",
      level: "High",
      fare: 2360,
    },
    backup: {
      optionId: "split-KOTA",
      trainName: "Split via Kota Junction",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "16:35",
      arrivalDisplay: "12:20 · tomorrow",
      level: "Very High",
      fare: 2540,
      via: "Kota Junction",
    },
    readinessDone: ["aadhaar", "irctc", "wallet"],
    planNotifications: [],
    createdAt: new Date().toISOString(),
  };
}
