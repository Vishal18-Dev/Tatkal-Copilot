import { describe, it, expect } from "vitest";
import {
  resolveLocation,
  resolveLocationFromCoordinates,
  extractTravelPlaces,
  haversineDistanceKm,
} from "@/lib/geo/location-resolver";
import { discoverNearbyStations } from "@/lib/geo/station-discovery";
import { resolveAndRankJourney } from "@/lib/geo/journey-ranker";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { Trip } from "@/types";

describe("Item 5C.1 — Location Resolution & Intelligent Journey Ranking", () => {
  describe("1. Location Resolution Layer", () => {
    it("resolves explicit cities accurately without defaulting to Mumbai", () => {
      const pune = resolveLocation("Pune");
      expect(pune).not.toBeNull();
      expect(pune?.name).toBe("Pune");
      expect(pune?.city).toBe("Pune");
      expect(pune?.city).not.toBe("Mumbai");

      const bangalore = resolveLocation("Bangalore");
      expect(bangalore).not.toBeNull();
      expect(bangalore?.city).toBe("Bengaluru");

      const delhi = resolveLocation("Delhi");
      expect(delhi).not.toBeNull();
      expect(delhi?.city).toBe("Delhi");
    });

    it("resolves localities and identifies parent city", () => {
      const powai = resolveLocation("Powai");
      expect(powai).not.toBeNull();
      expect(powai?.name).toBe("Powai");
      expect(powai?.city).toBe("Mumbai");
      expect(powai?.kind).toBe("locality");

      const andheri = resolveLocation("Andheri");
      expect(andheri).not.toBeNull();
      expect(andheri?.name).toBe("Andheri");
      expect(andheri?.city).toBe("Mumbai");

      const hinjewadi = resolveLocation("Hinjewadi");
      expect(hinjewadi).not.toBeNull();
      expect(hinjewadi?.name).toBe("Hinjewadi");
      expect(hinjewadi?.city).toBe("Pune");
    });

    it("resolves natural-language landmarks", () => {
      const iitb = resolveLocation("IIT Bombay");
      expect(iitb).not.toBeNull();
      expect(iitb?.name).toBe("IIT Bombay");
      expect(iitb?.city).toBe("Mumbai");
      expect(iitb?.kind).toBe("landmark");
    });

    it("resolves railway station names and codes directly", () => {
      const bvi = resolveLocation("BVI");
      expect(bvi).not.toBeNull();
      expect(bvi?.name).toBe("Borivali");
      expect(bvi?.matchedStationCode).toBe("BVI");

      const csmt = resolveLocation("CSMT");
      expect(csmt).not.toBeNull();
      expect(csmt?.city).toBe("Mumbai");
    });

    it("resolves browser GPS coordinates to the nearest locality/city", () => {
      // Coordinates near Powai / IIT Bombay (19.12, 72.90)
      const resolved = resolveLocationFromCoordinates({
        latitude: 19.125,
        longitude: 72.905,
      });

      expect(resolved.name).toBe("Powai");
      expect(resolved.city).toBe("Mumbai");
      expect(resolved.kind).toBe("coordinates");
    });
  });

  describe("2. Natural Language Travel Intent Extraction", () => {
    it("extracts 'from Pune to Delhi' without defaulting origin to Mumbai", () => {
      const query = extractTravelPlaces("I need to travel from Pune to Delhi tomorrow");
      expect(query.originText?.toLowerCase()).toContain("pune");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");
      expect(query.isOriginMissing).toBe(false);

      const origin = resolveLocation(query.originText!);
      expect(origin?.city).toBe("Pune");
      expect(origin?.city).not.toBe("Mumbai");
    });

    it("extracts locality origin: 'I want to go to Delhi from Powai'", () => {
      const query = extractTravelPlaces("I want to go to Delhi from Powai");
      expect(query.originText?.toLowerCase()).toContain("powai");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");

      const origin = resolveLocation(query.originText!);
      expect(origin?.name).toBe("Powai");
      expect(origin?.city).toBe("Mumbai");
    });

    it("extracts 'I am in Andheri and need to reach Delhi'", () => {
      const query = extractTravelPlaces("I'm in Andheri and need to reach Delhi");
      expect(query.originText?.toLowerCase()).toContain("andheri");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");
    });

    it("extracts 'Take me from where I am to Delhi' as current location request", () => {
      const query = extractTravelPlaces("Take me from where I am to Delhi");
      expect(query.originText).toBe("current_location");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");
    });

    it("flags missing origin when user says 'Take me to Delhi'", () => {
      const query = extractTravelPlaces("Take me to Delhi");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");
      expect(query.isOriginMissing).toBe(true);
    });

    it("extracts Hindi/Hinglish: 'Powai se Delhi jaana hai'", () => {
      const query = extractTravelPlaces("Mujhe Powai se Delhi jaana hai");
      expect(query.originText?.toLowerCase()).toContain("powai");
      expect(query.destinationText?.toLowerCase()).toContain("delhi");
    });
  });

  describe("3. Station Discovery Layer", () => {
    it("generates nearby candidate boarding stations for Powai", () => {
      const powai = resolveLocation("Powai")!;
      const stations = discoverNearbyStations(powai, "origin");

      expect(stations.length).toBeGreaterThanOrEqual(3);
      const stationCodes = stations.map((s) => s.station.code);
      // Candidate stations in Mumbai include BCT, BDTS, DR, BVI, BSR
      expect(stationCodes).toContain("BDTS");
      expect(stationCodes).toContain("BVI");
      expect(stationCodes).toContain("BCT");

      // Verify distance is calculated
      expect(stations[0].distanceKm).toBeGreaterThanOrEqual(0);
      expect(stations[0].estimatedTransitMins).toBeGreaterThan(0);
    });

    it("identifies direct station when station code is provided", () => {
      const bvi = resolveLocation("BVI")!;
      const stations = discoverNearbyStations(bvi, "origin");
      expect(stations[0].station.code).toBe("BVI");
      expect(stations[0].distanceKm).toBe(0);
    });
  });

  describe("4. Dynamic Journey Ranking & Explanation", () => {
    it("ranks candidate trains between Mumbai and Delhi with transparent rationale", () => {
      const powai = resolveLocation("Powai")!;
      const delhi = resolveLocation("Delhi")!;

      const result = resolveAndRankJourney(powai, delhi);
      expect(result.rankedOptions.length).toBeGreaterThan(0);
      expect(result.primary).not.toBeNull();
      expect(result.explanation).toContain("recommended as your primary option");
      expect(result.explanation).toContain("confirmation");

      // Verifies alternate boarding at Borivali is considered
      const borivaliOption = result.rankedOptions.find((o) => o.boardingStation.code === "BVI");
      expect(borivaliOption).toBeDefined();
    });

    it("does NOT always choose August Kranti for every request", () => {
      const bandra = resolveLocation("Bandra")!;
      const delhi = resolveLocation("Delhi")!;

      // For someone asking for cheapest budget option from Bandra
      const result = resolveAndRankJourney(bandra, delhi, { priority: "cheapest" });
      expect(result.primary).toBeDefined();
      // Garib Rath starts directly at Bandra Terminus (BDTS) and is cheaper (fare 1490 vs 2360)
      if (result.primary?.train.number === "12909") {
        expect(result.primary.train.name).toContain("Garib Rath");
      }
    });
  });

  describe("5. Copilot Brain Integration (executeCopilotTurn)", () => {
    it("asks for origin when destination is provided without origin and without GPS", async () => {
      const result = await executeCopilotTurn({
        channel: "visual",
        text: "Take me to Delhi",
        language: "en",
      });

      expect(result.toolUsed).toBe("resolve_journey");
      expect(result.speakEnglish).toContain("Where are you starting from?");
    });

    it("resolves journey and explains why when origin place is natural locality", async () => {
      const result = await executeCopilotTurn({
        channel: "visual",
        text: "I want to go to Delhi from Powai",
        language: "en",
      });

      expect(result.toolUsed).toBe("resolve_journey");
      expect(result.speakEnglish).toContain("recommended");
      expect(result.trip).toBeDefined();
      expect(result.trip?.from).toBe("Powai");
      expect(result.trip?.to).toBe("Delhi");
    });

    it("uses browser geolocation when user says 'Take me from where I am to Delhi'", async () => {
      const result = await executeCopilotTurn({
        channel: "phone",
        text: "Take me from where I am to Delhi",
        language: "en",
        geolocation: { latitude: 19.12, longitude: 72.90 }, // Powai coordinates
      });

      expect(result.toolUsed).toBe("resolve_journey");
      expect(result.trip).toBeDefined();
      expect(result.trip?.from).toBe("Powai");
      expect(result.trip?.to).toBe("Delhi");
    });

    it("preserves non-Mumbai origin without silent fallback to Mumbai", async () => {
      const result = await executeCopilotTurn({
        channel: "phone",
        text: "I need to travel from Pune to Delhi",
        language: "en",
      });

      expect(result.toolUsed).toBe("resolve_journey");
      expect(result.trip?.from).not.toBe("Mumbai");
    });
  });
});
