import { describe, it, expect } from "vitest";
import {
  QUOTA_POLICIES,
  getQuotaPolicy,
  validateQuotaCompatibility,
  evaluateStrategyEligibility,
} from "@/lib/booking/quota-policy";
import {
  generateCandidateStrategies,
  evaluateBookingStrategies,
} from "@/lib/booking/strategy-engine";
import type {
  BookingStrategy,
  UserBookingConstraints,
  StrategyAuthorization,
} from "@/lib/booking/types";
import type { RankedJourneyOption } from "@/lib/geo/types";
import { validateAgentDecision } from "@/lib/action-validator";
import { extractJourneyConstraints } from "@/lib/copilot/journey-state";
import { calculateStrategyReadinessReport, calculateStrategyReadiness } from "@/lib/readiness";
import type { Trip } from "@/types";

describe("TASK 5H — Quota & Policy Layer Specification", () => {
  it("1. GN, TQ, and PT quota policies are properly centralized", () => {
    const gn = getQuotaPolicy("GN");
    const tq = getQuotaPolicy("TQ");
    const pt = getQuotaPolicy("PT");

    expect(gn.quota).toBe("GN");
    expect(gn.allowsRAC).toBe(true);
    expect(gn.allowsWaitlist).toBe(true);
    expect(gn.dynamicPricing).toBe(false);

    expect(tq.quota).toBe("TQ");
    expect(tq.dynamicPricing).toBe(false);
    expect(tq.cancellationPolicy.confirmedTicketRefund).toBe(false);

    expect(pt.quota).toBe("PT");
    expect(pt.dynamicPricing).toBe(true);
    expect(pt.allowsRAC).toBe(false);
    expect(pt.allowsWaitlist).toBe(false);
    expect(pt.requiresIdentityReady).toBe(true);
    expect(pt.cancellationPolicy.confirmedTicketRefund).toBe(false);
  });

  it("2. PT strictly enforces confirmed-only (rejects RAC and WAITLIST)", () => {
    const confirmedRes = validateQuotaCompatibility("PT", "CONFIRMED");
    expect(confirmedRes.valid).toBe(true);

    const racRes = validateQuotaCompatibility("PT", "RAC");
    expect(racRes.valid).toBe(false);
    expect(racRes.reason).toContain("does not support RAC");

    const wlRes = validateQuotaCompatibility("PT", "WAITLIST");
    expect(wlRes.valid).toBe(false);
    expect(wlRes.reason).toContain("does not support waitlisted");

    // Regular Tatkal allows RAC and WL
    expect(validateQuotaCompatibility("TQ", "RAC").valid).toBe(true);
    expect(validateQuotaCompatibility("TQ", "WAITLIST").valid).toBe(true);
  });

  it("3. PT enforces Aadhaar / identity requirement", () => {
    const candidate: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason"> = {
      id: "strat_pt_1",
      journeyId: "j1",
      trainNumber: "12952",
      trainName: "Mumbai Tejas Rajdhani",
      quota: "PT",
      travelClass: "3A",
      boardingStation: { code: "BCT", name: "Mumbai Central" },
      arrivalStation: { code: "NDLS", name: "New Delhi" },
      departure: "17:00",
      arrival: "08:30",
      durationMins: 930,
      fare: {
        amount: 2800,
        currency: "INR",
        quota: "PT",
        isDynamic: true,
        isEstimated: false,
        fareSource: "live_railradar",
      },
      availability: "CONFIRMED",
      tatkalSuitability: "high",
      rationale: [],
      priorityScore: 90,
      authorizationRequired: true,
      provenance: {
        availabilitySource: "RailRadar",
        fareSource: "live_railradar",
        policySource: "quota-policy",
      },
    };

    // When identity is not ready, PT is blocked
    const notReadyRes = evaluateStrategyEligibility(candidate, {}, undefined, false, true);
    expect(notReadyRes.eligible).toBe(false);
    expect(notReadyRes.blockedReasonCodes).toContain("BLOCKED_BY_IDENTITY_REQUIREMENT");

    // When identity is ready, passes
    const readyRes = evaluateStrategyEligibility(candidate, {}, undefined, true, true);
    expect(readyRes.eligible).toBe(true);
  });
});

describe("TASK 5H — Independent Fare Ceilings Specification", () => {
  const basePTCandidate: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason"> = {
    id: "strat_pt_fare",
    journeyId: "j1",
    trainNumber: "12952",
    trainName: "Mumbai Tejas Rajdhani",
    quota: "PT",
    travelClass: "3A",
    boardingStation: { code: "BCT", name: "Mumbai Central" },
    arrivalStation: { code: "NDLS", name: "New Delhi" },
    departure: "17:00",
    arrival: "08:30",
    durationMins: 930,
    fare: {
      amount: 2800,
      currency: "INR",
      quota: "PT",
      isDynamic: true,
      isEstimated: false,
      fareSource: "live_railradar",
    },
    availability: "CONFIRMED",
    tatkalSuitability: "high",
    rationale: [],
    priorityScore: 90,
    authorizationRequired: true,
    provenance: {
      availabilitySource: "RailRadar",
      fareSource: "live_railradar",
      policySource: "quota-policy",
    },
  };

  it("1. maxFare blocks any strategy above the ceiling", () => {
    const res = evaluateStrategyEligibility(
      basePTCandidate,
      { maxFare: 2500 },
      undefined,
      true,
      true
    );
    expect(res.eligible).toBe(false);
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_FARE_LIMIT");
  });

  it("2. maxPremiumTatkalFare specifically blocks PT above ceiling", () => {
    const res = evaluateStrategyEligibility(
      basePTCandidate,
      { maxPremiumTatkalFare: 2600 },
      undefined,
      true,
      true
    );
    expect(res.eligible).toBe(false);
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_PT_FARE_LIMIT");
  });

  it("3. Both ceilings checked simultaneously: maxFare = 2500, maxPT = 3000 blocks ₹2800 PT", () => {
    // PT fare = 2800. It satisfies maxPT (3000), but violates maxFare (2500).
    // maxPremiumTatkalFare NEVER overrides maxFare.
    const res = evaluateStrategyEligibility(
      basePTCandidate,
      { maxFare: 2500, maxPremiumTatkalFare: 3000 },
      undefined,
      true,
      true
    );
    expect(res.eligible).toBe(false);
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_FARE_LIMIT");
  });

  it("4. PT within both ceilings is eligible (fare ₹2400, maxFare ₹2500, maxPT ₹3000)", () => {
    const candidateWithin = {
      ...basePTCandidate,
      fare: { ...basePTCandidate.fare, amount: 2400 },
    };
    const res = evaluateStrategyEligibility(
      candidateWithin,
      { maxFare: 2500, maxPremiumTatkalFare: 3000 },
      undefined,
      true,
      true
    );
    expect(res.eligible).toBe(true);
    expect(res.blockedReasonCodes.length).toBe(0);
  });
});

describe("TASK 5H — Zero Live Data Fabrication & Safety Rules", () => {
  const unknownCandidate: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason"> = {
    id: "strat_unknown",
    journeyId: "j1",
    trainNumber: "12952",
    trainName: "Mumbai Tejas Rajdhani",
    quota: "PT",
    travelClass: "3A",
    boardingStation: { code: "BCT", name: "Mumbai Central" },
    arrivalStation: { code: "NDLS", name: "New Delhi" },
    departure: "17:00",
    arrival: "08:30",
    durationMins: 930,
    fare: {
      amount: null,
      currency: "INR",
      quota: "PT",
      isDynamic: true,
      isEstimated: false,
      fareSource: "unavailable",
    },
    availability: "UNKNOWN",
    tatkalSuitability: "unsuitable",
    rationale: [],
    priorityScore: 0,
    authorizationRequired: true,
    provenance: {
      availabilitySource: "RailRadar",
      fareSource: "unavailable",
      policySource: "quota-policy",
    },
  };

  it("1. UNKNOWN availability cannot execute", () => {
    const res = evaluateStrategyEligibility(unknownCandidate, {}, undefined, true, true);
    expect(res.eligible).toBe(false);
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_UNKNOWN_AVAILABILITY");
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_UNKNOWN_FARE");
  });

  it("2. Explicit PT exclusion unconditionally blocks PT", () => {
    const eligiblePT: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason"> = {
      ...unknownCandidate,
      fare: { ...unknownCandidate.fare, amount: 2200 },
      availability: "CONFIRMED",
    };

    const res = evaluateStrategyEligibility(
      eligiblePT,
      { excludedQuotas: ["PT"] },
      undefined,
      true,
      true
    );
    expect(res.eligible).toBe(false);
    expect(res.blockedReasonCodes).toContain("BLOCKED_BY_USER_CONSTRAINT");
    expect(res.reasons[0]).toContain("excluded Premium Tatkal");
  });

  it("3. Action Validator blocks switch_to_premium_tatkal in Assisted mode without user action", () => {
    const mockTripAssisted = {
      id: "t1",
      status: "upcoming" as const,
      from: "Mumbai",
      fromCode: "BCT",
      to: "Delhi",
      toCode: "NDLS",
      dateLabel: "Tomorrow",
      trainName: "Tejas Rajdhani",
      travelClass: "3A" as const,
      travellerIds: ["p1"],
      boardingStationName: "Mumbai Central",
      arrivalDisplay: "08:30",
      fare: 2100,
      mode: "assisted" as const,
      createdAt: new Date().toISOString(),
      agentState: "primary_failed" as const,
      agentEnabled: false,
      tatkalOpensAtLabel: "10:00 AM",
      primary: {
        optionId: "opt1",
        trainName: "Tejas Rajdhani",
        travelClass: "3A" as const,
        boardingStationName: "Mumbai Central",
        departureDisplay: "17:00",
        arrivalDisplay: "08:30",
        level: "High" as const,
        fare: 2100,
        quota: "TQ" as const,
      },
      readinessDone: [],
      planNotifications: [],
    };

    const res = validateAgentDecision(
      {
        action: "switch_to_premium_tatkal",
        toolCall: {
          name: "switchToPremiumTatkal",
          arguments: { strategyId: "pt_strat", fare: 2500, maxFare: 3000 },
        },
        reason: "Primary failed",
        source: "local",
      },
      mockTripAssisted,
      new Set()
    );

    // In Assisted mode, autonomous switching is prohibited
    expect(res.valid).toBe(false);
    expect(res.reason).toContain("Assisted mode requires explicit user authorization");
  });

  it("4. Action Validator in Permissioned mode blocks if PT fare exceeds ceilings", () => {
    const mockTripAuto = {
      id: "t1",
      status: "upcoming" as const,
      from: "Mumbai",
      fromCode: "BCT",
      to: "Delhi",
      toCode: "NDLS",
      dateLabel: "Tomorrow",
      trainName: "Tejas Rajdhani",
      travelClass: "3A" as const,
      travellerIds: ["p1"],
      boardingStationName: "Mumbai Central",
      arrivalDisplay: "08:30",
      fare: 2100,
      mode: "auto" as const,
      createdAt: new Date().toISOString(),
      agentState: "primary_failed" as const,
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      primary: {
        optionId: "opt1",
        trainName: "Tejas Rajdhani",
        travelClass: "3A" as const,
        boardingStationName: "Mumbai Central",
        departureDisplay: "17:00",
        arrivalDisplay: "08:30",
        level: "High" as const,
        fare: 2100,
        quota: "TQ" as const,
      },
      readinessDone: [],
      planNotifications: [],
    };

    const res = validateAgentDecision(
      {
        action: "switch_to_premium_tatkal",
        toolCall: {
          name: "switchToPremiumTatkal",
          arguments: { strategyId: "pt_strat", fare: 3500, maxFare: 3000 },
        },
        reason: "Primary failed, auto fallback",
        source: "local",
      },
      mockTripAuto,
      new Set()
    );

    expect(res.valid).toBe(false);
    expect(res.reason).toContain("exceeds maximum fare limit of ₹3000");
  });

  it("5. Action Validator in Permissioned mode blocks if user explicitly prohibited PT", () => {
    const mockTripAuto = {
      id: "t1",
      status: "upcoming" as const,
      from: "Mumbai",
      fromCode: "BCT",
      to: "Delhi",
      toCode: "NDLS",
      dateLabel: "Tomorrow",
      trainName: "Tejas Rajdhani",
      travelClass: "3A" as const,
      travellerIds: ["p1"],
      boardingStationName: "Mumbai Central",
      arrivalDisplay: "08:30",
      fare: 2100,
      mode: "auto" as const,
      createdAt: new Date().toISOString(),
      agentState: "primary_failed" as const,
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      primary: {
        optionId: "opt1",
        trainName: "Tejas Rajdhani",
        travelClass: "3A" as const,
        boardingStationName: "Mumbai Central",
        departureDisplay: "17:00",
        arrivalDisplay: "08:30",
        level: "High" as const,
        fare: 2100,
        quota: "TQ" as const,
      },
      readinessDone: [],
      planNotifications: [],
    };

    const res = validateAgentDecision(
      {
        action: "switch_to_premium_tatkal",
        toolCall: {
          name: "switchToPremiumTatkal",
          arguments: { strategyId: "pt_strat", fare: 2500, maxFare: 3000, prohibitedQuotas: ["PT"] },
        },
        reason: "Auto fallback to PT",
        source: "local",
      },
      mockTripAuto,
      new Set()
    );

    expect(res.valid).toBe(false);
    expect(res.reason).toContain("prohibited Premium Tatkal");
  });
});

describe("TASK 5H — Booking Strategy Engine Ranking & Fallback Specification", () => {
  const mockJourneys: RankedJourneyOption[] = [
    {
      optionId: "opt_rajdhani",
      train: {
        number: "12952",
        name: "New Delhi Tejas Rajdhani",
        fromCode: "MMCT",
        toCode: "NDLS",
        departure: "17:00",
        arrival: "08:30",
        arrivalDayOffset: 1,
        durationMins: 930,
        runsOn: ["Daily"],
        classes: [],
        tatkalOpensAt: "10:00",
        competition: 80,
      },
      boardingStation: {
        code: "MMCT",
        name: "Mumbai Central",
        city: "Mumbai",
      },
      arrivalStation: {
        code: "NDLS",
        name: "New Delhi",
        city: "Delhi",
      },
      totalDurationMins: 930,
      trainDurationMins: 930,
      transitToStationMins: 0,
      tatkalConfirmProbability: 0.85,
      travelClass: "3A",
      fare: 2100,
      score: 92,
      rank: 1,
      reason: "Fastest direct train",
      isPrimary: true,
      isBackup: false,
    },
    {
      optionId: "opt_august_kranti",
      train: {
        number: "12954",
        name: "August Kranti Tejas Rajdhani",
        fromCode: "MMCT",
        toCode: "NZM",
        departure: "17:10",
        arrival: "09:45",
        arrivalDayOffset: 1,
        durationMins: 995,
        runsOn: ["Daily"],
        classes: [],
        tatkalOpensAt: "10:00",
        competition: 75,
      },
      boardingStation: {
        code: "MMCT",
        name: "Mumbai Central",
        city: "Mumbai",
      },
      arrivalStation: {
        code: "NZM",
        name: "Hazrat Nizamuddin",
        city: "Delhi",
      },
      totalDurationMins: 995,
      trainDurationMins: 995,
      transitToStationMins: 0,
      tatkalConfirmProbability: 0.80,
      travelClass: "3A",
      fare: 1950,
      score: 88,
      rank: 2,
      reason: "Excellent corridor backup",
      isPrimary: false,
      isBackup: true,
    },
  ];

  it("1. Generates TQ primary and PT fallback deterministically", () => {
    const result = evaluateBookingStrategies({
      rankedJourneys: mockJourneys,
      isDemoMode: true,
    });

    expect(result.primary).toBeDefined();
    expect(result.primary!.quota).toBe("TQ");
    expect(result.primary!.trainNumber).toBe("12952");

    expect(result.backup).toBeDefined();
    expect(result.backup?.quota).toBe("PT");
    expect(result.backup?.fare.isDynamic).toBe(true);

    expect(result.fallbackOrder.length).toBeGreaterThan(1);
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.primary!.rationale.length).toBeGreaterThan(0);
  });

  it("2. When PT is excluded by user, alternate train is selected as backup", () => {
    const result = evaluateBookingStrategies({
      rankedJourneys: mockJourneys,
      constraints: {
        excludedQuotas: ["PT"],
      },
      isDemoMode: true,
    });

    expect(result.primary!.quota).toBe("TQ");
    // Backup should NOT be PT
    expect(result.backup?.quota).toBe("TQ");
    expect(result.backup?.trainNumber).toBe("12954");
  });

  it("3. Price sensitivity prioritizes cheaper strategy within ceiling", () => {
    const result = evaluateBookingStrategies({
      rankedJourneys: mockJourneys,
      constraints: {
        priceSensitivity: "high",
        maxFare: 3000,
      },
      isDemoMode: true,
    });

    expect(result.primary).toBeDefined();
    expect(result.primary!.fare.amount).toBeLessThanOrEqual(3000);
  });

  it("4. Confirmation priority favors confirmed PT fallback", () => {
    const result = evaluateBookingStrategies({
      rankedJourneys: mockJourneys,
      constraints: {
        confirmationPriority: "high",
      },
      isDemoMode: true,
    });

    expect(result.backup?.quota).toBe("PT");
    expect(result.backup?.availability).toBe("CONFIRMED");
  });
});

describe("TASK 5H — Conversational Constraints Extraction (English, Hindi, Hinglish)", () => {
  it("1. English conversational constraints extracted correctly", () => {
    const c1 = extractJourneyConstraints("I can spend up to 3000");
    expect(c1.maxFare).toBe(3000);

    const c2 = extractJourneyConstraints("Don't use Premium Tatkal");
    expect(c2.excludedQuotas).toContain("PT");

    const c3 = extractJourneyConstraints("Premium Tatkal is okay up to 2500");
    expect(c3.maxPremiumTatkalFare).toBe(2500);

    const c4 = extractJourneyConstraints("I need the highest chance of confirmation");
    expect(c4.confirmationPriority).toBe("high");

    const c5 = extractJourneyConstraints("Use Pune station only");
    expect(c5.preferredBoardingStation).toBe("Pune");

    const c6 = extractJourneyConstraints("Find me the cheapest option");
    expect(c6.priceSensitivity).toBe("high");
  });

  it("2. Hindi / Hinglish conversational constraints extracted correctly", () => {
    const c1 = extractJourneyConstraints("3000 rupaye se zyada mat kharch karna");
    expect(c1.maxFare).toBe(3000);

    const c2 = extractJourneyConstraints("premium tatkal mat lena");
    expect(c2.excludedQuotas).toContain("PT");

    const c3 = extractJourneyConstraints("sabse sasta option batao");
    expect(c3.priceSensitivity).toBe("high");

    const c4 = extractJourneyConstraints("confirm hone ke sabse zyada chances chahiye");
    expect(c4.confirmationPriority).toBe("high");

    const c5 = extractJourneyConstraints("pune station se hi board karna");
    expect(c5.preferredBoardingStation).toBe("pune");
  });
});

describe("TASK 5H — Strategy Readiness Engine Specification", () => {
  const mockTrip: Trip = {
    id: "trip_readiness_test",
    status: "upcoming",
    from: "Mumbai",
    fromCode: "BCT",
    to: "Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "Mumbai Tejas Rajdhani",
    travelClass: "3A",
    travellerIds: ["p1", "p2"],
    boardingStationName: "Mumbai Central",
    arrivalDisplay: "08:30",
    fare: 2100,
    mode: "assisted",
    createdAt: new Date().toISOString(),
    agentState: "draft",
    agentEnabled: false,
    tatkalOpensAtLabel: "Tomorrow at 10:00 AM",
    primary: {
      optionId: "p1",
      trainName: "Mumbai Tejas Rajdhani",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "17:00",
      arrivalDisplay: "08:30",
      level: "High",
      fare: 2100,
      quota: "TQ",
    },
    backup: {
      optionId: "b1",
      trainName: "August Kranti Rajdhani",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "17:10",
      arrivalDisplay: "09:45",
      level: "High",
      fare: 2700,
      quota: "PT",
      isDynamic: true,
    },
    readinessDone: ["passengers", "boarding"],
    planNotifications: [],
  };

  it("1. Evaluates identity readiness, payment readiness, and PT eligibility", () => {
    const report = calculateStrategyReadinessReport(mockTrip);
    expect(report.identityReady).toBe(true);
    expect(report.strategyReady).toBe(true);
    expect(report.backupReady).toBe(true);
    expect(report.ptEligibility.isEligible).toBe(true);
    expect(report.fareCeilingStatus.withinCeiling).toBe(true);
  });

  it("2. Strategy is NOT ready merely because a train exists if fare ceiling is violated", () => {
    const tripWithLimit = {
      ...mockTrip,
      userConstraints: {
        maxFare: 2000, // primary fare is 2100 -> violates limit
      },
    } as any;

    const report = calculateStrategyReadinessReport(tripWithLimit);
    expect(report.fareCeilingStatus.withinCeiling).toBe(false);
    expect(report.strategyReady).toBe(false);
  });

  it("3. calculateStrategyReadiness includes extended checks while preserving base checks", () => {
    const detailed = calculateStrategyReadiness(mockTrip);
    expect(detailed.checks.some((c) => c.id === "strategy_readiness")).toBe(true);
    expect(detailed.checks.some((c) => c.id === "pt_eligibility")).toBe(true);
    expect(detailed.checks.some((c) => c.id === "fare_ceiling")).toBe(true);
  });
});
