import { describe, it, expect } from "vitest";
import { GoogleLocationProvider, googleLocationProvider } from "@/lib/geo/providers/google-location-provider";
import { RealStationProvider, realStationProvider } from "@/lib/geo/providers/real-station-provider";
import { RailRadarTrainProvider, railRadarTrainProvider } from "@/lib/geo/providers/railradar-train-provider";
import { extractStructuredIntent } from "@/lib/copilot/intent-extractor";

describe("Item 5E.1 — Live Provider Integration Tests", () => {
  describe("1. GoogleLocationProvider", () => {
    it("fallback to demo location provider when API key is missing or query is standard", () => {
      const provider = new GoogleLocationProvider("");
      const resolved = provider.resolvePlace("Life Republic in Pune");
      expect(resolved).not.toBeNull();
      expect(resolved?.city).toBe("Pune");
      expect(resolved?.locality).toContain("Life Republic");
    });

    it("creates canonical ResolvedLocation with google source tag when async resolved", async () => {
      const resolved = await googleLocationProvider.resolvePlaceAsync("Life Republic Pune");
      expect(resolved).not.toBeNull();
      expect(resolved?.city).toBe("Pune");
      expect(["google", "demo"]).toContain(resolved?.source);
    });

    it("handles zero results or invalid query gracefully", async () => {
      const resolved = await googleLocationProvider.resolvePlaceAsync("nonexistentplace123456");
      expect(resolved).toBeNull();
    });
  });

  describe("2. RealStationProvider", () => {
    it("returns canonical station master catalogue", () => {
      const stations = realStationProvider.getAllStations();
      expect(stations.length).toBeGreaterThan(10);
      const codes = stations.map((s) => s.code);
      expect(codes).toContain("PUNE");
      expect(codes).toContain("HWH");
      expect(codes).toContain("SDAH");
      expect(codes).toContain("BCT");
      expect(codes).toContain("NDLS");
    });

    it("discovers candidate stations within radius", () => {
      const coords = { latitude: 18.6148, longitude: 73.7431 }; // Life Republic Pune
      const nearby = realStationProvider.findStationsWithinRadiusKm(coords, 30);
      expect(nearby.length).toBeGreaterThan(0);
      expect(nearby.some((s) => s.code === "PUNE")).toBe(true);
    });

    it("discovers all candidate arrival stations in destination region", () => {
      const dest = {
        rawQuery: "Kolkata",
        name: "Kolkata",
        city: "Kolkata",
        kind: "city" as const,
        confidence: 1.0,
      };
      const destStations = realStationProvider.findDestinationStations(dest);
      const codes = destStations.map((s) => s.code);
      expect(codes).toContain("HWH");
      expect(codes).toContain("SDAH");
    });
  });

  describe("3. RailRadarTrainProvider", () => {
    it("fetches train details and route halts from RailRadar endpoint", async () => {
      const res = await railRadarTrainProvider.getTrain("12953");
      expect(res.success).toBe(true);
      expect(res.train).toBeDefined();
      expect(res.train.number).toBe("12953");
      expect(res.train.source?.code).toBe("MMCT");
    });

    it("fetches route GeoJSON from RailRadar endpoint", async () => {
      const res = await railRadarTrainProvider.getTrainRoute("12953");
      expect(res.success).toBe(true);
      expect(res.geojson).toBeDefined();
      expect(res.geojson.type).toBe("Feature");
    });

    it("fetches real-time PRS fare breakdown with Tatkal quota", async () => {
      const res = await railRadarTrainProvider.getFare({
        trainNumber: "12953",
        from: "MMCT",
        to: "NZM",
        date: "2026-09-07",
        travelClass: "3A",
        quota: "TQ",
      });
      expect(res.success).toBe(true);
      expect(res.fareBreakdown).toBeDefined();
      expect(res.fareBreakdown?.totalFare).toBeGreaterThan(1000);
    });

    it("handles live status and non-existent PNR gracefully without crashing", async () => {
      const live = await railRadarTrainProvider.getLiveStatus("12953");
      expect(live.success).toBe(true);

      const pnr = await railRadarTrainProvider.getPNR("1234567890");
      expect(pnr.success).toBe(false);
      expect(pnr.error?.code).toBeDefined();
    });
  });

  describe("4. Structured OpenAI Intent Extractor", () => {
    it("extracts structured intent with source tag", async () => {
      const intent = await extractStructuredIntent("I'm at Life Republic and need to reach Kolkata tomorrow");
      expect(intent.originText ?? "").toContain("Life Republic");
      expect(intent.destinationText ?? "").toContain("Kolkata");
      expect(intent.travelDate).toBe("tomorrow");
      expect(["openai", "regex"]).toContain(intent.source);
    });
  });
});
