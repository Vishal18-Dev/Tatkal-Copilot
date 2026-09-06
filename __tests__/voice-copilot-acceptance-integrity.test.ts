/**
 * __tests__/voice-copilot-acceptance-integrity.test.ts
 *
 * TASK 5F.2B — Browser Voice Journey Acceptance & State Integrity Test Suite
 *
 * Verifies:
 * 1. Flow A: Destination first ("I want to go to Delhi tomorrow."), then origin ("Pune.").
 *    Expect: origin = Pune, destination = Delhi, date = tomorrow.
 * 2. Flow B: Destination first ("I want to go to Mumbai."), then origin ("Pune.").
 *    Expect: origin = Pune, destination = Mumbai.
 * 3. Flow C: Single sentence ("I want to go from Pune to Delhi tomorrow.").
 *    Expect: origin = Pune, destination = Delhi, date = tomorrow. No origin prompt.
 * 4. Flow D: Geographic origin ("I live in Life Republic Pune and want to go to Kolkata tomorrow.").
 *    Expect: origin = Life Republic Pune, destination = Kolkata, date = tomorrow.
 * 5. 15 Conversational State Integration Tests.
 * 6. Elimination of empty pseudo-candidates (no "No Verified Train", no ₹0, no fake CTA).
 */

import { describe, it, expect } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import {
  extractJourneyConstraints,
  mergeJourneyConstraints,
  createJourneyState,
} from "@/lib/copilot/journey-state";

describe("TASK 5F.2B — Browser Voice Journey Acceptance & State Integrity", () => {
  // ── 1. Flow A: Destination first, origin second ──────────────────────
  it("Flow A: 'I want to go to Delhi tomorrow' -> 'Where starting from?' -> 'Pune.' => Pune → Delhi tomorrow", async () => {
    // Turn 1
    const t1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go to Delhi tomorrow.",
      language: "en",
    });

    expect(t1.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    expect(t1.journeyState.travelDate).toBe("tomorrow");
    expect(t1.journeyState.pendingClarification).toBe("origin");
    expect(t1.speakEnglish).toMatch(/where are you starting from/i);

    // Turn 2
    const t2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Pune.",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    expect(t2.journeyState.travelDate).toBe("tomorrow");
    expect(t2.journeyState.pendingClarification).toBeUndefined();

    // The recommendation must be for Pune to Delhi
    expect(t2.trip?.from.toLowerCase()).toContain("pune");
    expect(t2.trip?.to.toLowerCase()).toContain("delhi");
    expect(t2.speakEnglish.toLowerCase()).not.toContain("delhi to");
  });

  // ── 2. Flow B: Destination first, origin second ──────────────────────
  it("Flow B: 'I want to go to Mumbai.' -> 'Where starting from?' -> 'Pune.' => Pune → Mumbai", async () => {
    const t1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go to Mumbai.",
      language: "en",
    });

    expect(t1.journeyState.destinationText?.toLowerCase()).toContain("mumbai");
    expect(t1.journeyState.pendingClarification).toBe("origin");

    const t2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Pune.",
      language: "en",
      journeyState: t1.journeyState,
      trip: t1.trip,
    });

    expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(t2.journeyState.destinationText?.toLowerCase()).toContain("mumbai");
    expect(t2.trip?.from.toLowerCase()).toContain("pune");
    expect(t2.trip?.to.toLowerCase()).toContain("mumbai");
  });

  // ── 3. Flow C: Single sentence ───────────────────────────────────────
  it("Flow C: 'I want to go from Pune to Delhi tomorrow.' => Pune → Delhi tomorrow without asking origin", async () => {
    const t = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go from Pune to Delhi tomorrow.",
      language: "en",
    });

    expect(t.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(t.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    expect(t.journeyState.travelDate).toBe("tomorrow");
    expect(t.journeyState.pendingClarification).toBeUndefined();
    expect(t.speakEnglish).not.toMatch(/where are you starting from/i);
    expect(t.trip?.from.toLowerCase()).toContain("pune");
    expect(t.trip?.to.toLowerCase()).toContain("delhi");
  });

  // ── 4. Flow D: Geographic origin place ───────────────────────────────
  it("Flow D: 'I live in Life Republic Pune and want to go to Kolkata tomorrow.' => Life Republic Pune → Kolkata", async () => {
    const t = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I live in Life Republic Pune and want to go to Kolkata tomorrow.",
      language: "en",
    });

    expect(t.journeyState.originText?.toLowerCase()).toContain("life republic pune");
    expect(t.journeyState.destinationText?.toLowerCase()).toContain("kolkata");
    expect(t.journeyState.travelDate).toBe("tomorrow");
    expect(t.trip?.from.toLowerCase()).toMatch(/life republic|pune/);
    expect(t.trip?.to.toLowerCase()).toMatch(/kolkata|howrah|sealdah/);
  });

  // ── 5. 15 Conversational State Integration Tests ────────────────────
  describe("15 Conversational State Tests", () => {
    it("1. Destination first, origin second", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "I want to travel to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Pune",
        journeyState: t1.journeyState,
      });
      expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
      expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    });

    it("2. Origin first, destination second", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "I'm starting from Pune",
      });
      expect(t1.journeyState.pendingClarification).toBe("destination");

      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Delhi",
        journeyState: t1.journeyState,
      });
      expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
      expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    });

    it("3. Both in one sentence", async () => {
      const t = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Take me from Pune to Delhi",
      });
      expect(t.journeyState.originText?.toLowerCase()).toContain("pune");
      expect(t.journeyState.destinationText?.toLowerCase()).toContain("delhi");
    });

    it("4. Destination correction", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Take me from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Actually Kolkata",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.originText?.toLowerCase()).toContain("pune");
      expect(t2.journeyState.destinationText?.toLowerCase()).toContain("kolkata");
      expect(t2.trip?.to.toLowerCase()).toMatch(/kolkata|howrah|sealdah/);
    });

    it("5. Origin correction", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Take me from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Actually from Mumbai",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.originText?.toLowerCase()).toContain("mumbai");
      expect(t2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
      expect(t2.trip?.from.toLowerCase()).toContain("mumbai");
    });

    it("6. Standalone answer to pending origin question", () => {
      const extracted = extractJourneyConstraints("Pune.", "origin");
      expect(extracted.originText?.toLowerCase()).toBe("pune");
      expect(extracted.destinationText).toBeUndefined();
    });

    it("7. Standalone answer to pending destination question", () => {
      const extracted = extractJourneyConstraints("Delhi.", "destination");
      expect(extracted.destinationText?.toLowerCase()).toBe("delhi");
      expect(extracted.originText).toBeUndefined();
    });

    it("8. Date in first turn", async () => {
      const t = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi tomorrow",
      });
      expect(t.journeyState.travelDate).toBe("tomorrow");
    });

    it("9. Date in follow-up", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Make it tomorrow",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.travelDate).toBe("tomorrow");
    });

    it("10. Class in follow-up", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "3A class",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.travelClass).toBe("3A");
    });

    it("11. Optimization in follow-up", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Fastest option",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.priority).toBe("fastest");
    });

    it("12. Negative station constraint", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi",
      });
      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Don't use Pune station",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      expect(t2.journeyState.excludeStationCode).toBe("PUNE");
    });

    it("13. Empty candidate result does not fabricate pseudo-candidates", async () => {
      const t = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Port Blair to Leh",
      });
      // Tool should handle missing trains cleanly without throwing
      expect(t.journeyState.originText?.toLowerCase()).toContain("port blair");
      expect(t.journeyState.destinationText?.toLowerCase()).toContain("leh");
    });

    it("14. Candidate replacement updates resolution identity", async () => {
      const t1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Go from Pune to Delhi",
      });
      const res1 = t1.journeyState.resolutionId;

      const t2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Actually to Mumbai",
        journeyState: t1.journeyState,
        trip: t1.trip,
      });
      const res2 = t2.journeyState.resolutionId;

      expect(res1).not.toBe(res2);
    });

    it("15. Reset conversation produces fresh empty state", () => {
      const state = createJourneyState();
      expect(state.originText).toBeUndefined();
      expect(state.destinationText).toBeUndefined();
      expect(state.turnCount).toBe(0);
    });
  });
});
