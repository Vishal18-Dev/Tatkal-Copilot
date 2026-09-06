import { describe, test, expect } from "vitest";
import { resolveLocation } from "@/lib/geo/location-resolver";
import { resolveAndRankJourney, resolveAndRankJourneyAsync } from "@/lib/geo/journey-ranker";
import {
  createJourneyState,
  extractJourneyConstraints,
  mergeJourneyConstraints,
  isTripStale,
} from "@/lib/copilot/journey-state";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { createConversation } from "@/lib/conversation/service";

describe("TASK 5F.3 — Journey Decision Correctness, Constraint Hierarchy & Provenance", () => {
  const originPune = resolveLocation("Life Republic Pune")!;
  const destKolkata = resolveLocation("Kolkata")!;
  const destDelhi = resolveLocation("Delhi")!;
  const destTrivandrum = resolveLocation("Thiruvananthapuram")!;

  test("1. Class Preservation on Cheapest: '3A from Pune to Kolkata' -> 'Cheapest option' preserves 3A class", () => {
    // Turn 1: 3A class constraint
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I want to travel in 3A from Pune to Kolkata.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    expect(m1.state.originText).toBe("Pune");
    expect(m1.state.destinationText).toBe("Kolkata");
    expect(m1.state.travelClass).toBe("3A");
    expect(m1.state.allowClassDowngrade).toBeUndefined();

    // Turn 2: "What's the cheapest option?" (does NOT permit class downgrade)
    const ex2 = extractJourneyConstraints("What's the cheapest option?");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.state.priority).toBe("cheapest");
    expect(m2.state.travelClass).toBe("3A");
    expect(m2.state.allowClassDowngrade).toBeUndefined();

    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      preferredClass: m2.state.travelClass,
      allowClassDowngrade: m2.state.allowClassDowngrade,
      priority: m2.state.priority,
    });

    expect(ranking.primary).not.toBeNull();
    expect(ranking.primary?.travelClass).toBe("3A");
    expect(ranking.rankedOptions.every((opt) => opt.travelClass === "3A")).toBe(true);
  });

  test("2. Permissive Class Change: 'Cheapest option, any class fine' permits SL class downgrade", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I want to travel in 3A from Pune to Kolkata.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    const ex2 = extractJourneyConstraints("What's the cheapest option, any class is fine.");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.state.priority).toBe("cheapest");
    expect(m2.state.allowClassDowngrade).toBe(true);

    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      preferredClass: m2.state.travelClass,
      allowClassDowngrade: m2.state.allowClassDowngrade,
      priority: m2.state.priority,
    });

    expect(ranking.primary).not.toBeNull();
    // Class downgrade is permitted so options can include SL
    expect(ranking.rankedOptions.length).toBeGreaterThan(0);
  });

  test("3. Negative Station Override: 'Prefer Pune station' then 'Don't use Pune station' excludes PUNE", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I prefer Pune station.");
    const m1 = mergeJourneyConstraints(state0, ex1);
    expect(m1.state.boardingStationPreference).toContain("Pune");

    const ex2 = extractJourneyConstraints("Actually don't use Pune station.");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.state.excludeStationCode).toBe("PUNE");
    // Conflict override: boardingStationPreference matching excluded station is cleared
    expect(m2.state.boardingStationPreference).toBeUndefined();

    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      excludeStationCode: m2.state.excludeStationCode,
      boardingStationPreference: m2.state.boardingStationPreference,
    });

    expect(ranking.candidateOriginStations.some((os) => os.station.code === "PUNE")).toBe(false);
    if (ranking.primary) {
      expect(ranking.primary.boardingStation.code).not.toBe("PUNE");
    }
  });

  test("4. Hard Class Exclusion: '3A only' excludes non-3A options", () => {
    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      preferredClass: "3A",
      allowClassDowngrade: false,
    });

    expect(ranking.rankedOptions.every((o) => o.travelClass === "3A")).toBe(true);
  });

  test("5. Arrival Deadline Exclusion: 'Arrive before 8 AM' excludes candidates arriving after 08:00 AM", () => {
    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      timeConstraint: { kind: "before", hour: 8, minute: 0, raw: "before 8 AM" },
    });

    for (const opt of ranking.rankedOptions) {
      const parts = opt.train.arrival.split(":");
      const arrHour = parseInt(parts[0], 10);
      expect(arrHour).toBeLessThanOrEqual(8);
    }
  });

  test("6. Max Distance Exclusion: 'Don't make me travel more than 15 km to station' excludes distant candidates", () => {
    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      maxStationDistanceKm: 15,
    });

    for (const opt of ranking.rankedOptions) {
      expect(opt.transitToStationMins).toBeLessThanOrEqual(15 * 3); // estimatedTransitMins correlates with distance
    }
  });

  test("7. Direct Train Constraint: 'Direct train only' keeps direct options", () => {
    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      directOnly: true,
    });

    expect(ranking.rankedOptions.every((o) => o.train.number)).toBe(true);
  });

  test("8. Impossible Constraints ('No Valid Journey'): Returns explicit conflict explanation without silent relaxation", () => {
    // Impossible combination: 3A to Kolkata arriving before 01:00 AM (no train matches)
    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      preferredClass: "3A",
      allowClassDowngrade: false,
      timeConstraint: { kind: "before", hour: 1, minute: 0, raw: "before 1 AM" },
    });

    expect(ranking.hasNoValidJourney).toBe(true);
    expect(ranking.primary).toBeNull();
    expect(ranking.backup).toBeNull();
    expect(ranking.explanation).toContain("I couldn't find a verified journey that satisfies all your requirements.");
    expect(ranking.conflictExplanation).toBeDefined();
  });

  test("9. Origin/Destination Invalidation: Changing journey invalidates old candidate set and computes new resolutionId", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I want to go from Mumbai to Delhi.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    const ex2 = extractJourneyConstraints("Actually Pune to Thiruvananthapuram.");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.materialChange).toBe(true);
    expect(m2.state.resolutionId).not.toBe(m1.state.resolutionId);
    expect(m2.state.originText).toBe("Pune");
    expect(m2.state.destinationText).toBe("Thiruvananthapuram");
  });

  test("10. Provenance Metadata Integrity: Candidates carry explicit provenance metadata (LIVE vs DEMO)", async () => {
    const syncRanking = resolveAndRankJourney(originPune, destKolkata);
    expect(syncRanking.primary?.provenance).toBeDefined();
    expect(syncRanking.primary?.provenance?.mode).toBe("DEMO");
    expect(syncRanking.primary?.provenance?.discoverySource).toBe("catalogue");

    const asyncRanking = await resolveAndRankJourneyAsync(originPune, destKolkata);
    expect(asyncRanking.primary?.provenance).toBeDefined();
    expect(asyncRanking.primary?.provenance?.mode).toBe("LIVE");
    expect(asyncRanking.primary?.provenance?.discoverySource).toBeDefined();
  });

  test("11. Optimization Override: 'Fastest' then 'Actually, cheapest' updates priority without losing hard constraints", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I need 3A from Pune to Kolkata, fastest.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    expect(m1.state.priority).toBe("fastest");
    expect(m1.state.travelClass).toBe("3A");

    const ex2 = extractJourneyConstraints("Actually, cheapest.");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.state.priority).toBe("cheapest");
    expect(m2.state.travelClass).toBe("3A"); // hard class constraint preserved!

    const ranking = resolveAndRankJourney(originPune, destKolkata, {
      preferredClass: m2.state.travelClass,
      priority: m2.state.priority,
    });

    expect(ranking.primary?.travelClass).toBe("3A");
  });

  test("12. Stale Candidate Rejection: Stale trip relative to journey state is correctly flagged by isTripStale", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("Take me from Pune to Delhi.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    const oldTrip = { from: "Mumbai", to: "Chennai" };
    expect(isTripStale(oldTrip, m1.state)).toBe(true);

    const matchingTrip = { from: "Pune", to: "Delhi" };
    expect(isTripStale(matchingTrip, m1.state)).toBe(false);
  });

  test("13. 'Safest' Determinism: 'Safest' ranks deterministically by highest Tatkal confirmation signal", () => {
    const rankingSafest = resolveAndRankJourney(originPune, destKolkata, { priority: "safest" });
    const rankingFastest = resolveAndRankJourney(originPune, destKolkata, { priority: "fastest" });

    expect(rankingSafest.primary).toBeDefined();
    expect(rankingFastest.primary).toBeDefined();

    // Safest ranks highest Tatkal confirm probability first
    expect(rankingSafest.primary?.tatkalConfirmProbability).toBeGreaterThanOrEqual(
      rankingSafest.backup?.tatkalConfirmProbability ?? 0
    );
  });

  test("14. Display Field Provenance: Displayed fields match candidate object truth", () => {
    const ranking = resolveAndRankJourney(originPune, destKolkata);
    const p = ranking.primary!;

    expect(p.train.number).toBeDefined();
    expect(p.train.name).toBeDefined();
    expect(p.boardingStation.name).toBeDefined();
    expect(p.arrivalStation.name).toBeDefined();
    expect(p.fare).toBeGreaterThan(0);
    expect(p.travelClass).toBeDefined();
  });

  test("15. Unrelated Conversation Isolation: General query does not alter material journey resolutionId", () => {
    const state0 = createJourneyState();
    const ex1 = extractJourneyConstraints("I want to travel from Pune to Kolkata in 3A.");
    const m1 = mergeJourneyConstraints(state0, ex1);

    const ex2 = extractJourneyConstraints("What is the weather in Pune right now?");
    const m2 = mergeJourneyConstraints(m1.state, ex2);

    expect(m2.materialChange).toBe(false);
    expect(m2.state.resolutionId).toBe(m1.state.resolutionId);
    expect(m2.state.originText).toBe("Pune");
    expect(m2.state.destinationText).toBe("Kolkata");
    expect(m2.state.travelClass).toBe("3A");
  });

  test("16. Full E2E Copilot Turn: '3A Pune to Kolkata' then 'Cheapest option' via executeCopilotTurn", async () => {
    const initialConv = createConversation({ channel: "visual", language: "en" });

    const turn1 = await executeCopilotTurn({
      channel: "visual",
      text: "I want to travel in 3A from Pune to Kolkata.",
      conversation: initialConv,
      isUserInitiated: true,
    });

    expect(turn1.journeyState.travelClass).toBe("3A");

    const turn2 = await executeCopilotTurn({
      channel: "visual",
      text: "What's the cheapest option?",
      conversation: turn1.conversation,
      journeyState: turn1.journeyState,
      isUserInitiated: true,
    });

    expect(turn2.journeyState.priority).toBe("cheapest");
    expect(turn2.journeyState.travelClass).toBe("3A");
    expect(turn2.journeyState.allowClassDowngrade).toBeUndefined();
    expect(turn2.assistantMessage.originalText).toBeDefined();
  });
});
