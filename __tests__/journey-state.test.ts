/**
 * __tests__/journey-state.test.ts
 *
 * Item 5D — Adversarial Test Matrix
 * 12 scenarios that verify Conversational Journey State & Constraint Reconciliation.
 *
 * Each test verifies that:
 *   - journey constraints accumulate correctly across turns
 *   - corrections override stale constraints
 *   - unchanged constraints survive
 *   - stale recommendations are invalidated
 *   - demo defaults never override explicit user information
 *   - follow-up actions (show backup, book it) use the CURRENT journey
 */

import { describe, it, expect } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import {
  extractJourneyConstraints,
  mergeJourneyConstraints,
  createJourneyState,
  journeyStateFromTrip,
  computeResolutionId,
  isTripStale,
} from "@/lib/copilot/journey-state";
import type { Trip } from "@/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** A minimal stub trip for demo / seeding purposes. */
function makeTrip(from: string, to: string, overrides: Partial<Trip> = {}): Trip {
  return {
    id: "demo_trip",
    status: "upcoming",
    from,
    fromCode: from.toUpperCase().slice(0, 4),
    to,
    toCode: to.toUpperCase().slice(0, 4),
    dateLabel: "Tomorrow",
    trainName: `${from}–${to} Express`,
    travelClass: "3A",
    travellerIds: ["p1"],
    boardingStationName: `${from} Junction`,
    arrivalDisplay: "19:10 · tomorrow",
    fare: 2000,
    mode: "assisted",
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    primary: {
      optionId: "opt1",
      trainName: `${from}–${to} Express`,
      travelClass: "3A",
      boardingStationName: `${from} Junction`,
      departureDisplay: "07:00",
      arrivalDisplay: "19:10 · tomorrow",
      level: "High",
      fare: 2000,
    },
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/* ================================================================== */
/* Part 1 — Unit-level: extractJourneyConstraints                      */
/* ================================================================== */

describe("extractJourneyConstraints — unit", () => {
  it("extracts explicit from/to", () => {
    const c = extractJourneyConstraints("I want to go from Pune to Delhi tomorrow");
    expect(c.originText?.toLowerCase()).toContain("pune");
    expect(c.destinationText?.toLowerCase()).toContain("delhi");
    expect(c.travelDate).toBe("tomorrow");
    expect(c.isCorrection).toBe(false);
  });

  it("detects correction phrases", () => {
    const c = extractJourneyConstraints("Actually, I want Delhi instead");
    expect(c.isCorrection).toBe(true);
    expect(c.destinationText?.toLowerCase()).toContain("delhi");
  });

  it("extracts residential context into residentOf, not origin", () => {
    const c = extractJourneyConstraints("I live in Pune");
    expect(c.residentOf?.toLowerCase()).toContain("pune");
    expect(c.originText).toBeUndefined(); // raw extractor — merge promotes
  });

  it("extracts boarding preference separately from origin", () => {
    const c = extractJourneyConstraints("I live in Powai but I can board from Borivali");
    expect(c.residentOf?.toLowerCase()).toContain("powai");
    expect(c.boardingStationPreference?.toLowerCase()).toContain("borivali");
    expect(c.originText).toBeUndefined();
  });

  it("parses 'by 9 PM' as 21:00", () => {
    const c = extractJourneyConstraints("I want to go to Chennai by 9 PM tomorrow");
    expect(c.timeConstraint).toBeDefined();
    expect(c.timeConstraint?.kind).toBe("by");
    expect(c.timeConstraint?.hour).toBe(21);
    expect(c.timeConstraint?.minute).toBe(0);
  });

  it("parses 'after 10' without AM/PM as 22:00", () => {
    const c = extractJourneyConstraints("Actually make it after 10");
    expect(c.timeConstraint?.kind).toBe("after");
    expect(c.timeConstraint?.hour).toBe(22);
  });

  it("parses 'at 10' without AM/PM as 22:00", () => {
    const c = extractJourneyConstraints("Actually Delhi at 10");
    expect(c.timeConstraint?.hour).toBe(22);
  });

  it("extracts destination-only correction without verb", () => {
    const c = extractJourneyConstraints("Actually Delhi");
    expect(c.isCorrection).toBe(true);
    expect(c.destinationText?.toLowerCase()).toContain("delhi");
  });

  it("extracts 'Actually Bangalore'", () => {
    const c = extractJourneyConstraints("Actually Bangalore");
    expect(c.isCorrection).toBe(true);
    expect(c.destinationText?.toLowerCase()).toContain("bangalore");
  });

  it("extracts origin-only correction 'Actually from Mumbai'", () => {
    const c = extractJourneyConstraints("Actually from Mumbai");
    expect(c.isCorrection).toBe(true);
    expect(c.originText?.toLowerCase()).toContain("mumbai");
  });
});

/* ================================================================== */
/* Part 2 — Unit-level: mergeJourneyConstraints                        */
/* ================================================================== */

describe("mergeJourneyConstraints — unit", () => {
  it("promotes residentOf to originText when no explicit origin exists", () => {
    const state = createJourneyState();
    const extracted = extractJourneyConstraints("I live in Pune");
    const { state: next, materialChange } = mergeJourneyConstraints(state, extracted);
    expect(next.originText?.toLowerCase()).toContain("pune");
    expect(next.residentOf?.toLowerCase()).toContain("pune");
    expect(materialChange).toBe(true);
  });

  it("does NOT promote residentOf when boarding preference overrides in same utterance", () => {
    const state = createJourneyState();
    const extracted = extractJourneyConstraints("I live in Pune but board from Mumbai");
    const { state: next } = mergeJourneyConstraints(state, extracted);
    // residentOf is still set
    expect(next.residentOf?.toLowerCase()).toContain("pune");
    // boardingStationPreference is set
    expect(next.boardingStationPreference?.toLowerCase()).toContain("mumbai");
    // originText = residentOf (Pune) because boarding pref doesn't replace origin
    expect(next.originText?.toLowerCase()).toContain("pune");
  });

  it("preserves unchanged constraints across turns", () => {
    let state = createJourneyState();
    state = mergeJourneyConstraints(state, extractJourneyConstraints("Go to Chennai tomorrow")).state;
    // Change only destination
    const { state: next, changedFields } = mergeJourneyConstraints(
      state,
      extractJourneyConstraints("Actually Delhi")
    );
    expect(next.destinationText?.toLowerCase()).toContain("delhi");
    expect(next.travelDate).toBe("tomorrow"); // preserved
    expect(changedFields).toContain("destination");
    expect(changedFields).not.toContain("travelDate");
  });

  it("recomputes resolutionId when origin changes", () => {
    const state = createJourneyState();
    const s1 = mergeJourneyConstraints(state, extractJourneyConstraints("Go from Pune to Delhi")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Actually from Mumbai")).state;
    expect(s1.resolutionId).not.toBe(s2.resolutionId);
    expect(s2.originText?.toLowerCase()).toContain("mumbai");
    expect(s2.destinationText?.toLowerCase()).toContain("delhi"); // preserved
  });

  it("does not change resolutionId if nothing material changed", () => {
    const state = createJourneyState();
    const s1 = mergeJourneyConstraints(state, extractJourneyConstraints("Go from Pune to Delhi")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Tell me about the trains")).state;
    expect(s1.resolutionId).toBe(s2.resolutionId);
  });
});

/* ================================================================== */
/* Part 3 — isTripStale                                                */
/* ================================================================== */

describe("isTripStale", () => {
  it("returns true when trip from does not match state origin", () => {
    const trip = makeTrip("Mumbai", "Chennai");
    let state = createJourneyState();
    state = mergeJourneyConstraints(state, extractJourneyConstraints("Go from Pune to Delhi")).state;
    expect(isTripStale(trip, state)).toBe(true);
  });

  it("returns false when trip matches state", () => {
    const trip = makeTrip("Pune", "Delhi");
    let state = createJourneyState();
    state = mergeJourneyConstraints(state, extractJourneyConstraints("Go from Pune to Delhi")).state;
    expect(isTripStale(trip, state)).toBe(false);
  });

  it("returns false when state has no origin/dest constraints yet", () => {
    const trip = makeTrip("Mumbai", "Delhi");
    const state = createJourneyState(); // no constraints yet
    expect(isTripStale(trip, state)).toBe(false);
  });
});

/* ================================================================== */
/* Part 4 — 12 Adversarial Scenarios (executeCopilotTurn)             */
/* ================================================================== */

describe("Item 5D — 12 Adversarial Scenarios", () => {
  // ── Scenario 1: Direct "Pune to Delhi" ──────────────────────────────
  it("1. 'I want to go from Pune to Delhi' → trip.from = Pune, trip.to = Delhi", async () => {
    const result = await executeCopilotTurn({
      channel: "visual",
      text: "I want to go from Pune to Delhi",
      language: "en",
    });

    expect(result.toolUsed).toBe("resolve_journey");
    expect(result.trip).toBeDefined();
    expect(result.trip?.from.toLowerCase()).toContain("pune");
    expect(result.trip?.to.toLowerCase()).toContain("delhi");
    expect(result.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(result.journeyState.destinationText?.toLowerCase()).toContain("delhi");
  });

  // ── Scenario 2: Direct "Mumbai to Chennai" ─────────────────────────
  it("2. 'I want to go from Mumbai to Chennai' → trip.from = Mumbai", async () => {
    const result = await executeCopilotTurn({
      channel: "visual",
      text: "I want to go from Mumbai to Chennai",
      language: "en",
    });

    expect(result.trip?.from.toLowerCase()).toContain("mumbai");
    expect(result.trip?.to.toLowerCase()).toContain("chennai");
  });

  // ── Scenario 3: Destination correction ─────────────────────────────
  it("3. Turn 1 'Go to Chennai tomorrow' → Turn 2 'Actually Delhi' → dest = Delhi, same journey", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go to Chennai tomorrow",
      language: "en",
    });
    expect(t1.journeyState.destinationText?.toLowerCase()).toContain("chennai");
    expect(t1.journeyState.travelDate).toBe("tomorrow");

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually Delhi",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    expect(t2.journeyState.travelDate).toBe("tomorrow"); // preserved
    // Previous Chennai recommendation must NOT survive in the response
    expect(t2.speakEnglish.toLowerCase()).not.toContain("chennai");
    // If a trip was produced (origin was known), it must not be Chennai
    if (t2.trip) {
      expect(t2.trip.to.toLowerCase()).not.toContain("chennai");
    }
  });

  // ── Scenario 4: Origin added mid-conversation ───────────────────────
  it("4. Turn 1 'Go to Chennai tomorrow' + Turn 2 'I'm in Pune' → origin = Pune, dest = Chennai", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go to Chennai tomorrow",
      language: "en",
    });

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "I'm in Pune",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("chennai");
  });

  // ── Scenario 5: Destination + time both corrected ──────────────────
  it("5. Turn 1 'Go to Chennai tomorrow at 9' + Turn 2 'Actually Delhi at 10' → dest = Delhi, time = 22:00", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go to Chennai tomorrow at 9",
      language: "en",
    });
    expect(t1.journeyState.timeConstraint?.hour).toBe(21); // 9 PM

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually Delhi at 10",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    expect(t2.journeyState.timeConstraint?.hour).toBe(22); // 10 PM
    expect(t2.journeyState.travelDate).toBe("tomorrow"); // preserved
  });

  // ── Scenario 6: Origin correction ──────────────────────────────────
  it("6. Turn 1 'Take me from Pune to Delhi' + Turn 2 'Actually from Mumbai' → origin = Mumbai, dest = Delhi", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Take me from Pune to Delhi",
      language: "en",
    });
    expect(t1.journeyState.originText?.toLowerCase()).toContain("pune");

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually from Mumbai",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.originText?.toLowerCase()).toContain("mumbai");
    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi"); // preserved
    expect(t2.trip?.from.toLowerCase()).not.toContain("pune");
  });

  // ── Scenario 7: Destination correction to Bangalore ────────────────
  it("7. Turn 1 'Go to Delhi' + Turn 2 'Actually Bangalore' → dest = Bengaluru", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go to Delhi",
      language: "en",
    });

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually Bangalore",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.destinationText?.toLowerCase()).toMatch(/bangalore|bengaluru/);
    expect(t2.speakEnglish.toLowerCase()).not.toContain("delhi");
  });

  // ── Scenario 8: Boarding pref distinct from origin ──────────────────
  it("8. Turn 1 'Go from Powai to Delhi' + Turn 2 'Actually board from Borivali' → origin = Powai, boarding = Borivali", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go from Powai to Delhi",
      language: "en",
    });
    expect(t1.journeyState.originText?.toLowerCase()).toContain("powai");

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually board from Borivali",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.originText?.toLowerCase()).toContain("powai"); // origin unchanged
    expect(t2.journeyState.boardingStationPreference?.toLowerCase()).toContain("borivali");
    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi"); // preserved
  });

  // ── Scenario 9: Backup belongs to current journey ──────────────────
  it("9. Turn 1 'Go from Pune to Delhi' + Turn 2 'Show me the backup' → backup is Pune→Delhi", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go from Pune to Delhi",
      language: "en",
    });
    expect(t1.trip?.from.toLowerCase()).toContain("pune");
    expect(t1.trip?.to.toLowerCase()).toContain("delhi");

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Show me the backup",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip, // threaded from turn 1
    });

    expect(t2.toolUsed).toBe("get_backup_option");
    // The response must not reference a Mumbai or Chennai journey
    expect(t2.speakEnglish.toLowerCase()).not.toContain("mumbai–chennai");
    expect(t2.speakEnglish.toLowerCase()).not.toContain("chennai");
  });

  // ── Scenario 10: Booking action uses updated journey ───────────────
  it("10. Turn 1 'Go from Pune to Delhi' + Turn 2 'Book it' → booking action uses Pune-origin trip", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "Go from Pune to Delhi",
      language: "en",
    });

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Book it",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip, // threaded
    });

    expect(t2.toolUsed).toBe("request_booking_confirmation");
    // The booking speak must reference the Pune→Delhi train, not a Mumbai train
    expect(t2.speakEnglish.toLowerCase()).not.toContain("mumbai");
  });

  // ── Scenario 11: Stale recommendation is invalidated ──────────────
  it("11. Stale recommendation: existing Mumbai→Chennai trip is rejected after Pune→Delhi update", async () => {
    const staleMumbaiChennaiTrip = makeTrip("Mumbai", "Chennai");

    // User now says Pune to Delhi — trip should be considered stale
    const result = await executeCopilotTurn({
      channel: "visual",
      text: "I want to go from Pune to Delhi",
      language: "en",
      trip: staleMumbaiChennaiTrip, // stale input trip
    });

    // The response must not recommend the old Mumbai→Chennai route
    expect(result.speakEnglish.toLowerCase()).not.toContain("mumbai");
    expect(result.speakEnglish.toLowerCase()).not.toContain("chennai");

    // The new trip should reflect Pune→Delhi
    expect(result.trip?.from.toLowerCase()).toContain("pune");
    expect(result.trip?.to.toLowerCase()).toContain("delhi");

    // The old trip ID should have been replaced (material change)
    expect(result.trip?.id).not.toBe("demo_trip");
  });

  // ── Scenario 12: Demo fallback overridden by user's explicit origin ─
  it("12. Demo Mumbai→Delhi + user says 'I'm in Pune' → Pune becomes active origin", async () => {
    const demoTrip = makeTrip("Mumbai", "Delhi");

    const result = await executeCopilotTurn({
      channel: "visual",
      text: "I'm in Pune",
      language: "en",
      trip: demoTrip, // demo defaults
    });

    // journeyState should have Pune as origin, not Mumbai
    expect(result.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(result.journeyState.originText?.toLowerCase()).not.toBe("mumbai");

    // The stale Mumbai→Delhi demo trip must have been rejected
    expect(result.speakEnglish.toLowerCase()).not.toContain("august kranti");
    // Copilot should re-resolve from Pune or ask for destination
    expect(
      result.speakEnglish.toLowerCase().includes("pune") ||
      result.speakEnglish.toLowerCase().includes("where would you like") ||
      result.toolUsed === "resolve_journey"
    ).toBe(true);
  });
});

/* ================================================================== */
/* Part 5 — Resolution Identity Enforcement                            */
/* ================================================================== */

describe("Resolution Identity Enforcement", () => {
  it("resolutionId changes when origin changes", () => {
    const s0 = createJourneyState();
    const s1 = mergeJourneyConstraints(s0, extractJourneyConstraints("Go from Pune to Delhi")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Actually from Mumbai")).state;
    expect(s1.resolutionId).not.toBe(s2.resolutionId);
  });

  it("resolutionId changes when destination changes", () => {
    const s0 = createJourneyState();
    const s1 = mergeJourneyConstraints(s0, extractJourneyConstraints("Go from Pune to Delhi")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Actually Bangalore")).state;
    expect(s1.resolutionId).not.toBe(s2.resolutionId);
  });

  it("resolutionId changes when time constraint changes", () => {
    const s0 = createJourneyState();
    const s1 = mergeJourneyConstraints(s0, extractJourneyConstraints("Go to Delhi by 9 PM")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Actually after 10")).state;
    expect(s1.resolutionId).not.toBe(s2.resolutionId);
  });

  it("resolutionId is stable across non-material turns", () => {
    const s0 = createJourneyState();
    const s1 = mergeJourneyConstraints(s0, extractJourneyConstraints("Go from Pune to Delhi")).state;
    const s2 = mergeJourneyConstraints(s1, extractJourneyConstraints("Tell me more")).state;
    expect(s1.resolutionId).toBe(s2.resolutionId);
  });

  it("journeyStateFromTrip seeds resolutionId from trip fields", () => {
    const trip = makeTrip("Mumbai", "Delhi");
    const state = journeyStateFromTrip(trip);
    expect(state.resolutionId).toBeTruthy();
    expect(state.originText).toBe("Mumbai");
    expect(state.destinationText).toBe("Delhi");
  });

  it("executeCopilotTurn returns resolutionId that matches its emitted trip route", async () => {
    const t1 = await executeCopilotTurn({
      channel: "visual",
      text: "I want to go from Pune to Delhi",
      language: "en",
    });

    const t2 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually from Mumbai",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    // After the origin changes, the resolutionId must have changed
    expect(t2.journeyState.resolutionId).not.toBe(t1.journeyState.resolutionId);

    // And the trip must reflect the new origin (Mumbai), not the old (Pune)
    expect(t2.trip?.from.toLowerCase()).not.toContain("pune");
  });
});
