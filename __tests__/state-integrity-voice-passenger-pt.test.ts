import { describe, it, expect } from "vitest";
import { parseConversationalPassengerCount, extractJourneyConstraints } from "@/lib/copilot/journey-state";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import { INVALID_EXACT } from "@/lib/geo/place-guard";
import { getRailwayMetadata } from "@/lib/geo/railway-metadata";
import { evaluateStrategyEligibility } from "@/lib/booking/quota-policy";
import { matchSpokenPassengers } from "@/lib/journey";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { BookingStrategy, UserBookingConstraints } from "@/lib/booking/types";
import type { Traveller } from "@/types";

describe("State Integrity — Voice, Passenger, and Premium Tatkal", () => {
  describe("1. Passenger Count Must Never Be Inferred", () => {
    it("extracts explicit count from 'The ticket is for two passengers. Let's go with 3A and enable premium Tatkal.'", () => {
      const text = "The ticket is for two passengers. Let's go with 3A and enable premium Tatkal.";
      const count = parseConversationalPassengerCount(text);
      expect(count).toBe(2);

      const constraints = extractJourneyConstraints(text);
      expect(constraints.passengerCount).toBe(2);
      expect(constraints.travelClass).toBe("3A");
      expect(constraints.allowedQuotas).toContain("PT");

      const localIntent = parseIntentLocally(text);
      expect(localIntent.passengers).toBe(2);
      expect(localIntent.preferredClass).toBe("3A");
    });

    it("extracts various conversational number formats", () => {
      expect(parseConversationalPassengerCount("for two people")).toBe(2);
      expect(parseConversationalPassengerCount("ticket is for two passengers")).toBe(2);
      expect(parseConversationalPassengerCount("hum do log ja rahe hain")).toBe(2);
      expect(parseConversationalPassengerCount("hum 2 log")).toBe(2);
      expect(parseConversationalPassengerCount("teen log")).toBe(3);
      expect(parseConversationalPassengerCount("four seats")).toBe(4);
      expect(parseConversationalPassengerCount("1 adult")).toBe(1);
      expect(parseConversationalPassengerCount("2 adults and 1 child")).toBe(3);
    });

    it("NEVER defaults missing passenger count to 1", () => {
      const text = "Mumbai to Delhi tomorrow in 3A";
      expect(parseConversationalPassengerCount(text)).toBeUndefined();

      const constraints = extractJourneyConstraints(text);
      expect(constraints.passengerCount).toBeUndefined();

      const plan = buildPlanLocally(parseIntentLocally(text));
      expect(plan.intent.passengers).toBeUndefined();
    });

    it("prompts 'How many passengers will be travelling?' when origin, dest, and date are known but passengers is unknown", async () => {
      const result = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Delhi to Mumbai tomorrow",
      });

      expect(result.speakText).toContain("How many passengers will be travelling?");
      expect(result.journeyState.pendingClarification).toBe("passengerCount");
    });

    it("preserves extracted passenger count across subsequent clarification turns (e.g. Pune)", async () => {
      // Turn 1: User specifies two passengers with missing origin
      const turn1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Need 2 tickets to Delhi tomorrow",
      });
      expect(turn1.journeyState.passengerCount).toBe(2);
      expect(turn1.journeyState.pendingClarification).toBe("origin");

      // Turn 2: User clarifies origin: "Pune"
      const turn2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Pune",
        journeyState: turn1.journeyState,
      });

      expect(turn2.journeyState.originText).toBe("Pune");
      expect(turn2.journeyState.passengerCount).toBe(2);
    });
  });

  describe("2. Never Invent Passenger Names", () => {
    const mockTravellers: Traveller[] = [
      { id: "t1", name: "Manoj Sharma", age: 42, gender: "M", berthPreference: "Lower", mealPreference: "Veg", isSenior: false },
      { id: "t2", name: "Sunita Sharma", age: 39, gender: "F", berthPreference: "Middle", mealPreference: "Veg", isSenior: false },
      { id: "t3", name: "Aarav Sharma", age: 14, gender: "M", berthPreference: "Upper", mealPreference: "Veg", isSenior: false },
    ];

    it("does NOT select any passenger names when user only states a count", () => {
      const text = "The ticket is for two passengers. Let's go with 3A and enable premium Tatkal.";
      const matched = matchSpokenPassengers(text, mockTravellers);
      expect(matched).toHaveLength(0);
    });

    it("selects passenger names if and only if explicitly spoken in the utterance", () => {
      const textWithNames = "Book for Manoj and Sunita in 3A";
      const matched = matchSpokenPassengers(textWithNames, mockTravellers);
      expect(matched).toEqual(["t1", "t2"]);
    });

    it("matches single spoken passenger accurately", () => {
      const textWithOneName = "Tatkal ticket for Aarav";
      const matched = matchSpokenPassengers(textWithOneName, mockTravellers);
      expect(matched).toEqual(["t3"]);
    });
  });

  describe("3. Conversational Acknowledgements Never Become Locations", () => {
    it("contains 'okay', 'ok', 'sure', 'yes', 'fine', 'haan' in INVALID_EXACT place guard", () => {
      const sampleAcks = ["okay", "ok", "sure", "yes", "right", "got it", "fine", "haan", "theek hai", "hmm"];
      for (const ack of sampleAcks) {
        expect(INVALID_EXACT.has(ack)).toBe(true);
      }
    });

    it("does NOT resolve 'Okay' as origin when origin is pending, and re-prompts specifically", async () => {
      const turn1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Book ticket to Delhi tomorrow",
      });
      expect(turn1.journeyState.pendingClarification).toBe("origin");

      const turn2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Okay.",
        journeyState: turn1.journeyState,
      });

      // Origin should remain unset, NOT resolved to Okay, Oklahoma
      expect(turn2.journeyState.originText).toBeUndefined();
      expect(turn2.journeyState.pendingClarification).toBe("origin");
      expect(turn2.speakText).toContain("I still need your starting location. Which city or area are you leaving from?");
    });
  });

  describe("4. Authoritative Railway Metadata Correctness", () => {
    it("resolves Pune (PUNE) to Central Railway / Pune Division", () => {
      const meta = getRailwayMetadata("PUNE");
      expect(meta.zoneCode).toBe("CR");
      expect(meta.zoneName).toBe("Central Railway");
      expect(meta.division).toBe("Pune Division");
    });

    it("resolves New Delhi (NDLS) to Northern Railway", () => {
      const meta = getRailwayMetadata("NDLS");
      expect(meta.zoneCode).toBe("NR");
      expect(meta.zoneName).toBe("Northern Railway");
    });

    it("resolves Mumbai Central (MMCT / BCT) to Western Railway", () => {
      const metaMmct = getRailwayMetadata("MMCT");
      expect(metaMmct.zoneCode).toBe("WR");
      expect(metaMmct.zoneName).toBe("Western Railway");

      const metaBct = getRailwayMetadata("BCT");
      expect(metaBct.zoneCode).toBe("WR");
      expect(metaBct.zoneName).toBe("Western Railway");
    });
  });

  describe("5. Premium Tatkal Eligibility, Ceilings, and UNKNOWN Fare Guard", () => {
    const baseStrategy: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason"> = {
      id: "strat-1",
      journeyId: "j-1",
      trainNumber: "12951",
      trainName: "Tejas Rajdhani",
      quota: "PT",
      travelClass: "3A",
      boardingStation: { code: "MMCT", name: "Mumbai Central" },
      arrivalStation: { code: "NDLS", name: "New Delhi" },
      departure: "17:00",
      arrival: "08:32",
      durationMins: 932,
      availability: "CONFIRMED",
      tatkalSuitability: "high",
      rationale: ["Fastest direct train"],
      priorityScore: 90,
      authorizationRequired: false,
      provenance: {
        availabilitySource: "irctc",
        fareSource: "irctc",
        policySource: "irctc",
      },
      fare: {
        amount: 3200,
        currency: "INR",
        quota: "PT",
        isDynamic: true,
        isEstimated: false,
        fareSource: "irctc_provider",
      },
    };

    it("blocks execution when PT fare is UNKNOWN (fare.amount === null)", () => {
      const unknownFareStrategy = {
        ...baseStrategy,
        fare: {
          amount: null,
          currency: "INR" as const,
          quota: "PT" as const,
          isDynamic: true,
          isEstimated: false,
          fareSource: "unavailable" as const,
        },
      };

      const result = evaluateStrategyEligibility(unknownFareStrategy, {});
      expect(result.eligible).toBe(false);
      expect(result.blockedReasonCodes).toContain("BLOCKED_BY_UNKNOWN_FARE");
    });

    it("enforces maxFare and maxPremiumTatkalFare independently", () => {
      // PT fare = 3200
      // Case 1: Within maxFare (4000), but exceeds maxPremiumTatkalFare (3000)
      const constraints1: UserBookingConstraints = {
        maxFare: 4000,
        maxPremiumTatkalFare: 3000,
      };
      const result1 = evaluateStrategyEligibility(baseStrategy, constraints1);
      expect(result1.eligible).toBe(false);
      expect(result1.blockedReasonCodes).toContain("BLOCKED_BY_PT_FARE_LIMIT");

      // Case 2: Within maxPremiumTatkalFare (3500), but exceeds maxFare (3000)
      const constraints2: UserBookingConstraints = {
        maxFare: 3000,
        maxPremiumTatkalFare: 3500,
      };
      const result2 = evaluateStrategyEligibility(baseStrategy, constraints2);
      expect(result2.eligible).toBe(false);
      expect(result2.blockedReasonCodes).toContain("BLOCKED_BY_FARE_LIMIT");

      // Case 3: Satisfies both (maxFare: 4000, maxPremiumTatkalFare: 3500)
      const constraints3: UserBookingConstraints = {
        maxFare: 4000,
        maxPremiumTatkalFare: 3500,
      };
      const result3 = evaluateStrategyEligibility(baseStrategy, constraints3);
      expect(result3.eligible).toBe(true);
      expect(result3.blockedReasonCodes).toHaveLength(0);
    });
  });
});
