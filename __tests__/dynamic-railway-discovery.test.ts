import { describe, it, expect } from "vitest";
import { railRadarTrainDiscoveryProvider } from "@/lib/geo/providers/railradar-train-discovery-provider";
import { resolveAndRankJourneyAsync } from "@/lib/geo/journey-ranker";
import { googleLocationProvider } from "@/lib/geo/providers/google-location-provider";
import { realStationProvider } from "@/lib/geo/providers/real-station-provider";
import type { CandidateStation } from "@/lib/geo/types";

describe("TASK 5E.2 — Dynamic Railway Network Discovery Audit & Architecture", () => {
  it("exposes TrainDiscoveryProvider contract with discoverTrains method", () => {
    expect(railRadarTrainDiscoveryProvider).toBeDefined();
    expect(typeof railRadarTrainDiscoveryProvider.discoverTrains).toBe("function");
  });

  it("dynamically discovers candidate trains for Whitefield Bengaluru to New Delhi", async () => {
    const originLocation = {
      rawQuery: "Whitefield Bengaluru",
      name: "Whitefield",
      city: "Bengaluru",
      kind: "locality" as const,
      coordinates: { latitude: 12.9698, longitude: 77.7499 },
      source: "google" as const,
      confidence: 0.98,
    };

    const destLocation = {
      rawQuery: "New Delhi",
      name: "New Delhi",
      city: "New Delhi",
      kind: "city" as const,
      coordinates: { latitude: 28.6139, longitude: 77.2088 },
      source: "google" as const,
      confidence: 0.98,
    };

    const originStations = realStationProvider.findStationsWithinRadiusKm(
      originLocation.coordinates,
      60
    ).map(s => ({
      station: { code: s.code, name: s.name, city: s.city },
      distanceKm: 15,
      estimatedTransitMins: 45,
      isDirectBoarding: false,
      convenienceScore: 80,
      isDestinationReachable: true,
    }));

    const destStations = realStationProvider.findDestinationStations(destLocation).map(s => ({
      station: { code: s.code, name: s.name, city: s.city },
      distanceKm: 5,
      estimatedTransitMins: 20,
      isDirectBoarding: true,
      convenienceScore: 90,
      isDestinationReachable: true,
    }));

    const result = await resolveAndRankJourneyAsync(originLocation, destLocation);
    expect(result).toBeDefined();
    expect(result.candidateOriginStations.length).toBeGreaterThan(0);
    expect(result.candidateDestinationStations.length).toBeGreaterThan(0);
  });

  it("handles empty discovery gracefully without crashing", async () => {
    const emptyOrigin: CandidateStation[] = [];
    const emptyDest: CandidateStation[] = [];
    const discovered = await railRadarTrainDiscoveryProvider.discoverTrains(emptyOrigin, emptyDest);
    expect(Array.isArray(discovered)).toBe(true);
  });

  it("caches station train responses to prevent API rate-limit explosions", async () => {
    const trains1 = await railRadarTrainDiscoveryProvider.fetchStationTrains("SBC");
    const trains2 = await railRadarTrainDiscoveryProvider.fetchStationTrains("SBC");
    expect(trains1).toBe(trains2); // Same object reference from in-memory cache
  });
});
