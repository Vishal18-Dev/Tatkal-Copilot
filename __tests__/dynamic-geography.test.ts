import { describe, it, expect } from "vitest";
import { resolveLocation, resolveLocationFromCoordinates, extractTravelPlaces } from "@/lib/geo/location-resolver";
import { discoverBoardingStations } from "@/lib/geo/station-discovery";
import { resolveAndRankJourney } from "@/lib/geo/journey-ranker";
import { demoLocationProvider } from "@/lib/geo/providers/demo-location-provider";
import { demoStationProvider } from "@/lib/geo/providers/demo-station-provider";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { createJourneyState } from "@/lib/copilot/journey-state";
import type { ResolvedLocation } from "@/lib/geo/types";

describe("Item 5E — Dynamic Geographic Journey Intelligence", () => {
  describe("1. Location Resolution", () => {
    it("resolves Life Republic in Pune with locality and city", () => {
      const loc = resolveLocation("Life Republic in Pune");
      expect(loc).not.toBeNull();
      expect(loc?.city).toBe("Pune");
      expect(loc?.locality).toContain("Life Republic");
      expect(loc?.coordinates).toBeDefined();
    });

    it("resolves Whitefield to Bengaluru", () => {
      const loc = resolveLocation("Whitefield");
      expect(loc).not.toBeNull();
      expect(loc?.city).toBe("Bengaluru");
      expect(loc?.locality).toBe("Whitefield");
    });

    it("resolves Salt Lake to Kolkata", () => {
      const loc = resolveLocation("Salt Lake");
      expect(loc).not.toBeNull();
      expect(loc?.city).toBe("Kolkata");
      expect(loc?.locality).toBe("Salt Lake");
    });

    it("resolves GPS coordinates near Life Republic to Pune", () => {
      const coords = { latitude: 18.614, longitude: 73.743 }; // Life Republic coords
      const loc = resolveLocationFromCoordinates(coords);
      expect(loc.city).toBe("Pune");
      expect(loc.source).toBe("gps");
    });

    it("returns null for completely invalid / non-existent place", () => {
      const loc = resolveLocation("xyzxyznonexistentplace999");
      expect(loc).toBeNull();
    });
  });

  describe("2. Destination-Aware Station Discovery", () => {
    it("discovers Pune Junction for Life Republic when traveling to Kolkata", () => {
      const origin = resolveLocation("Life Republic")!;
      const dest = resolveLocation("Kolkata")!;

      const candidates = discoverBoardingStations(origin, dest);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].station.code).toBe("PUNE");
      expect(candidates[0].isDestinationReachable).toBe(true);
    });

    it("discovers Mumbai stations for Powai when traveling to Delhi", () => {
      const origin = resolveLocation("Powai")!;
      const dest = resolveLocation("Delhi")!;

      const candidates = discoverBoardingStations(origin, dest);
      expect(candidates.length).toBeGreaterThan(0);
      const codes = candidates.map((c) => c.station.code);
      expect(codes).toContain("BCT");
      expect(codes).not.toContain("PUNE");
    });
  });

  describe("3. Boarding Preference Enforcement", () => {
    it("enforces explicit boarding station preference with bonus score", () => {
      const origin = resolveLocation("Life Republic")!;
      const dest = resolveLocation("Kolkata")!;

      const ranking = resolveAndRankJourney(origin, dest, {
        boardingStationPreference: "PUNE",
      });

      expect(ranking.primary).not.toBeNull();
      expect(ranking.primary?.boardingStation.code).toBe("PUNE");
      expect(ranking.primary?.journeyScore?.boardingPreferenceBonus).toBe(20);
    });

    it("handles explicit station with no direct train gracefully", () => {
      const origin = resolveLocation("Life Republic")!;
      const dest = resolveLocation("Kolkata")!;

      // BCT has Mumbai-Howrah trains, but suppose user asked for BDTS
      const candidates = discoverBoardingStations(origin, dest, {
        explicitStationCode: "DR",
      });

      const drCandidate = candidates.find((c) => c.station.code === "DR");
      expect(drCandidate).toBeDefined();
      expect(drCandidate?.isExplicitPreference).toBe(true);
    });
  });

  describe("4. Journey Ranking & Door-to-Door Scoring", () => {
    it("ranks Sealdah Duronto for Pune -> Kolkata with full door-to-door metrics", () => {
      const origin = resolveLocation("Life Republic in Pune")!;
      const dest = resolveLocation("Salt Lake in Kolkata")!;

      const ranking = resolveAndRankJourney(origin, dest);

      expect(ranking.primary).not.toBeNull();
      expect(ranking.primary?.train.number).toBe("12259"); // Sealdah Duronto
      expect(ranking.primary?.boardingStation.code).toBe("PUNE");
      expect(ranking.primary?.arrivalStation.code).toBe("SDAH");

      // Verify door-to-door metrics exist
      expect(ranking.primary?.transitToStationMins).toBeGreaterThan(0);
      expect(ranking.primary?.onwardAccessMins).toBeGreaterThan(0);
      expect(ranking.primary?.totalDoorToDoorMins).toBeGreaterThan(0);

      // Verify JourneyScore explanation points
      expect(ranking.primary?.journeyScore?.reasons.length).toBeGreaterThan(0);
      expect(ranking.explanation).toContain("Sealdah Duronto Express");
    });
  });

  describe("5. End-to-End Copilot Conversational Journey Resolution", () => {
    it("resolves 'I live in Life Republic in Pune and I want to go to Kolkata tomorrow'", async () => {
      const result = await executeCopilotTurn({
        channel: "browser_voice",
        text: "I live in Life Republic in Pune and I want to go to Kolkata tomorrow",
      });

      expect(result.ok).toBe(true);
      expect(result.journeyState.originText).toContain("Life Republic");
      expect(result.journeyState.destinationText).toContain("Kolkata");
      expect(result.speakEnglish).toContain("Duronto");
      expect(result.trip?.from).toContain("Life Republic");
      expect(result.trip?.to).toContain("Kolkata");
    });

    it("handles conversational corrections across turns", async () => {
      // Turn 1
      const turn1 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "I want to go to Chennai tomorrow",
      });

      expect(turn1.journeyState.destinationText).toBe("Chennai");

      // Turn 2: Correction
      const turn2 = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Actually, I want to go to Kolkata and I live in Life Republic in Pune",
        journeyState: turn1.journeyState,
      });

      expect(turn2.journeyState.destinationText).toBe("Kolkata");
      expect(turn2.journeyState.originText).toContain("Life Republic");
      expect(turn2.speakEnglish).toContain("Duronto");
    });

    it("uses GPS coordinates when user says 'from where I am'", async () => {
      const result = await executeCopilotTurn({
        channel: "browser_voice",
        text: "Take me to Kolkata from where I am",
        geolocation: { latitude: 18.6148, longitude: 73.7431 }, // Life Republic
      });

      expect(result.ok).toBe(true);
      expect(result.speakEnglish).toContain("Duronto");
    });
  });
});
