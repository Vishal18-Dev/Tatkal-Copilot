/* ============================================================
   Tatkal Copilot — Booking Strategy Engine
   
   Separation of Concerns:
     Journey Ranker: "Which journey/train is best?"
     Strategy Engine: "Given available journey options, which booking
                       strategy maximizes securing this trip?"
   ============================================================ */

import type { RankedJourneyOption } from "@/lib/geo/types";
import type {
  BookingStrategy,
  BookingQuota,
  AvailabilityStatus,
  FareInfo,
  UserBookingConstraints,
  StrategyAuthorization,
  StrategyEvaluationResult,
  StrategyProvenance,
} from "./types";
import { evaluateStrategyEligibility, getQuotaPolicy } from "./quota-policy";

export interface StrategyEngineInput {
  rankedJourneys: RankedJourneyOption[];
  constraints?: UserBookingConstraints;
  authorization?: StrategyAuthorization;
  identityReady?: boolean;
  paymentReady?: boolean;
  isDemoMode?: boolean;
}

/**
 * Builds candidate booking strategies across all available journeys,
 * evaluating Regular Tatkal, Premium Tatkal, alternate trains, and alternate stations.
 */
export function generateCandidateStrategies(
  rankedJourneys: RankedJourneyOption[],
  isDemoMode = false
): BookingStrategy[] {
  const strategies: BookingStrategy[] = [];

  for (const journey of rankedJourneys) {
    const train = journey.train;
    const journeyId = journey.optionId;
    const baseFare =
      typeof journey.fare === "number"
        ? journey.fare
        : typeof (train as any).baseFare === "number"
          ? (train as any).baseFare
          : typeof (train as any).fare === "number"
            ? (train as any).fare
            : null;
    const travelClass = journey.travelClass;
    const boarding = {
      code: journey.boardingStation.code,
      name: journey.boardingStation.name,
    };
    const arrival = {
      code: journey.arrivalStation.code,
      name: journey.arrivalStation.name,
    };

    // ── Strategy 1: Regular Tatkal (TQ) ──────────────────────
    const tqFare: FareInfo = {
      amount: baseFare,
      currency: "INR",
      quota: "TQ",
      isDynamic: false,
      baseFare: baseFare,
      dynamicComponent: 0,
      isEstimated: false,
      fareSource: isDemoMode ? "demo_state_machine" : "live_railradar",
    };

    const tqProvenance: StrategyProvenance = {
      availabilitySource: journey.provenance?.discoverySource ?? "railradar",
      fareSource: isDemoMode ? "demo_state_machine" : "live_railradar",
      policySource: "quota-policy",
      isDemoData: isDemoMode,
    };

    // Calculate suitability from door-to-door characteristics
    let tqSuitability: BookingStrategy["tatkalSuitability"] = "high";
    if (journey.rank > 2) tqSuitability = "moderate";

    const tqStrategy: BookingStrategy = {
      id: `${journeyId}_TQ`,
      journeyId,
      trainNumber: (train as any).number || (train as any).trainNumber || "",
      trainName: (train as any).name || (train as any).trainName || "",
      quota: "TQ",
      travelClass,
      boardingStation: boarding,
      arrivalStation: arrival,
      departure: train.departure,
      arrival: train.arrival,
      durationMins: journey.totalDoorToDoorMins ?? journey.totalDurationMins ?? (train as any).durationMins ?? 0,
      fare: tqFare,
      availability: "CONFIRMED", // Target quota availability
      tatkalSuitability: tqSuitability,
      rationale: [],
      priorityScore: 0,
      status: "eligible",
      authorizationRequired: false,
      provenance: tqProvenance,
    };
    strategies.push(tqStrategy);

    // ── Strategy 2: Premium Tatkal (PT) ──────────────────────
    // Zero Live Data Fabrication Principle:
    // In live mode, if PT data is not explicitly provided by live provider, availability is UNKNOWN.
    // In demo mode, deterministic mock PT dynamic pricing scenario is provided.
    let ptAvailability: AvailabilityStatus = "UNKNOWN";
    let ptFareAmount: number | null = null;
    let ptDynamicComponent: number | null = null;
    let ptFareSource: FareInfo["fareSource"] = "unavailable";

    if (isDemoMode || process.env.DEMO_MODE === "true") {
      // Deterministic demo dynamic pricing: PT fare is ~35% dynamic premium over TQ base fare
      const dynamicMarkup = Math.round(baseFare * 0.35);
      ptFareAmount = baseFare + dynamicMarkup;
      ptDynamicComponent = dynamicMarkup;
      ptAvailability = "CONFIRMED";
      ptFareSource = "demo_state_machine";
    }

    const ptFare: FareInfo = {
      amount: ptFareAmount,
      currency: "INR",
      quota: "PT",
      isDynamic: true,
      baseFare: baseFare,
      dynamicComponent: ptDynamicComponent,
      isEstimated: false,
      fareSource: ptFareSource,
    };

    const ptProvenance: StrategyProvenance = {
      availabilitySource: isDemoMode ? "demo_state_machine" : "RailRadar",
      fareSource: ptFareSource,
      policySource: "quota-policy",
      isDemoData: isDemoMode,
    };

    const ptStrategy: BookingStrategy = {
      id: `${journeyId}_PT`,
      journeyId,
      trainNumber: (train as any).number || (train as any).trainNumber || "",
      trainName: (train as any).name || (train as any).trainName || "",
      quota: "PT",
      travelClass,
      boardingStation: boarding,
      arrivalStation: arrival,
      departure: train.departure,
      arrival: train.arrival,
      durationMins: journey.totalDoorToDoorMins ?? journey.totalDurationMins ?? (train as any).durationMins ?? 0,
      fare: ptFare,
      availability: ptAvailability,
      tatkalSuitability: "high", // PT is confirmed-only, higher confirmation chance when available
      rationale: [],
      priorityScore: 0,
      status: "eligible",
      authorizationRequired: true, // PT involves dynamic pricing & non-refundability
      provenance: ptProvenance,
    };
    strategies.push(ptStrategy);
  }

  return strategies;
}

/**
 * Evaluates, filters, scores, and ranks candidate booking strategies
 * based on user constraints, fare ceilings, quota policies, and priorities.
 */
export function evaluateBookingStrategies(input: StrategyEngineInput): StrategyEvaluationResult {
  const constraints = input.constraints ?? {};
  const auth = input.authorization;
  const isDemo = input.isDemoMode ?? (process.env.DEMO_MODE === "true");
  const identityReady = input.identityReady ?? true;
  const paymentReady = input.paymentReady ?? true;

  // 1. Generate candidate strategies
  const allCandidates = generateCandidateStrategies(input.rankedJourneys, isDemo);

  // 2. Evaluate eligibility & block reasons for each candidate
  for (const strategy of allCandidates) {
    const eligibility = evaluateStrategyEligibility(
      strategy,
      constraints,
      auth,
      identityReady,
      paymentReady
    );

    if (eligibility.eligible) {
      strategy.status = "eligible";
    } else {
      strategy.status = eligibility.blockedReasonCodes.includes("BLOCKED_BY_UNKNOWN_AVAILABILITY") ||
                        eligibility.blockedReasonCodes.includes("BLOCKED_BY_UNKNOWN_FARE")
        ? "unavailable"
        : "blocked";
      strategy.blockedReasonCodes = eligibility.blockedReasonCodes;
      strategy.blockedReason = eligibility.reasons.join(" ");
    }
  }

  // 3. Score eligible strategies
  for (const strategy of allCandidates) {
    let score = 100;

    // Fast duration bonus
    score -= (strategy.durationMins / 60) * 1.5;

    // Quota baseline & suitability
    if (strategy.quota === "TQ") {
      score += 20; // Default preference for regular fare
    } else if (strategy.quota === "PT") {
      score += 10;
    }

    // Confirmation priority
    if (constraints.confirmationPriority === "high") {
      if (strategy.quota === "PT" && strategy.availability === "CONFIRMED") {
        score += 35; // Substantial confirmation uplift for confirmed PT
      }
    } else if (constraints.confirmationPriority === "low") {
      if (strategy.quota === "PT") score -= 10;
    }

    // Price sensitivity
    if (constraints.priceSensitivity === "high") {
      // Heavily penalize high fares / dynamic pricing
      if (strategy.fare.amount !== null) {
        score -= (strategy.fare.amount / 100) * 1.2;
      }
      if (strategy.quota === "PT") {
        score -= 25; // Strongly favor cheaper regular Tatkal or alternate trains
      }
    } else if (constraints.priceSensitivity === "low") {
      // Price does not matter, prioritize securing seat
      if (strategy.quota === "PT") score += 15;
    }

    // Preferred boarding station
    if (constraints.preferredBoardingStation) {
      const codeUpper = strategy.boardingStation.code.toUpperCase();
      const prefUpper = constraints.preferredBoardingStation.toUpperCase();
      if (codeUpper === prefUpper || strategy.boardingStation.name.toUpperCase().includes(prefUpper)) {
        score += 25;
      } else {
        score -= 10;
      }
    }

    // Arrival priority / time
    if (constraints.arrivalPriority === "high") {
      const parts = strategy.arrival.split(":");
      const arrivalHour = parseInt(parts[0], 10) || 0;
      if (arrivalHour <= 9) score += 20; // Arrives early morning
    }

    // Blocked strategies get heavy negative score
    if (strategy.status !== "eligible") {
      score -= 1000;
    }

    strategy.priorityScore = Math.round(score);
  }

  // 4. Rank candidates deterministically
  const ranked = [...allCandidates].sort((a, b) => b.priorityScore - a.priorityScore);

  // 5. Synthesize human-readable rationale
  for (const strategy of ranked) {
    const rationale: string[] = [];
    const policy = getQuotaPolicy(strategy.quota);

    if (strategy.quota === "TQ") {
      rationale.push("Regular Tatkal fare");
    } else if (strategy.quota === "PT") {
      rationale.push("Premium Tatkal confirmed-only availability");
      if (strategy.fare.amount !== null) {
        rationale.push(`Dynamic fare of ₹${strategy.fare.amount.toLocaleString("en-IN")}`);
      }
    }

    if (strategy.fare.amount !== null && constraints.maxFare) {
      if (strategy.fare.amount <= constraints.maxFare) {
        rationale.push(`Within your ₹${constraints.maxFare.toLocaleString("en-IN")} fare limit`);
      }
    }

    if (constraints.preferredBoardingStation && strategy.boardingStation.code.toUpperCase() === constraints.preferredBoardingStation.toUpperCase()) {
      rationale.push(`Boards from your preferred station (${strategy.boardingStation.name})`);
    }

    if (constraints.confirmationPriority === "high" && strategy.quota === "PT") {
      rationale.push("Prioritizes verified confirmation over price");
    }

    if (strategy.status === "blocked") {
      if (strategy.blockedReason) {
        rationale.push(`Status: ${strategy.blockedReason}`);
      }
    }

    strategy.rationale = rationale;
  }

  // 6. Select Primary & Backup
  const eligible = ranked.filter((s) => s.status === "eligible");
  const primary = eligible[0] ?? null;

  // Backup should ideally be a distinct strategy (e.g. PT on same train for instant seat recovery, or alternate train)
  let backup: BookingStrategy | null = null;
  if (primary) {
    const alternates = eligible.slice(1);
    // If primary is TQ, prefer PT on the same train as immediate fallback, then alternate train
    backup = alternates.find((s) => s.trainNumber === primary.trainNumber && s.quota === "PT") ??
             alternates.find((s) => s.trainNumber !== primary.trainNumber) ??
             alternates.find((s) => s.quota !== primary.quota) ??
             alternates[0] ??
             null;
  }

  // Fallback order
  const fallbackOrder = primary ? eligible.filter((s) => s.id !== primary.id) : [];

  // Generate plain-language summary explanation
  let explanation = "";
  if (primary) {
    const primaryPolicy = getQuotaPolicy(primary.quota);
    const fareStr = primary.fare.amount ? `₹${primary.fare.amount.toLocaleString("en-IN")}` : "fare on confirmation";
    explanation = `${primary.trainName} via ${primaryPolicy.displayName} (${primary.boardingStation.name} → ${primary.arrivalStation.name}, ${primary.travelClass}, ${fareStr}) is your primary strategy.`;

    if (backup) {
      const backupPolicy = getQuotaPolicy(backup.quota);
      const backupFare = backup.fare.amount ? `₹${backup.fare.amount.toLocaleString("en-IN")}` : "standard fare";
      explanation += ` If unavailable, Copilot will evaluate ${backup.trainName} (${backupPolicy.displayName}, ${backupFare}) as backup.`;
    }
  } else {
    explanation = "No eligible booking strategy found that satisfies all your budget and quota constraints.";
  }

  return {
    primary,
    backup,
    candidates: ranked,
    fallbackOrder,
    explanation,
    activeConstraints: constraints,
  };
}
