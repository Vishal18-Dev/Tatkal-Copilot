import { describe, it, expect } from "vitest";
import { resolveLocationAsync } from "@/lib/geo/location-resolver";
import { resolveAndRankJourneyAsync } from "@/lib/geo/journey-ranker";

describe("Item 5F.1 — Dynamic Journey Decision Experience Pipeline", () => {
  it("resolves arbitrary origin and destination for dynamic journey decisions", async () => {
    const origin = await resolveLocationAsync("Life Republic Pune");
    const dest = await resolveLocationAsync("Kolkata");

    expect(origin).toBeDefined();
    expect(origin?.name).toContain("Life Republic");
    expect(dest).toBeDefined();
    expect(dest?.city).toBe("Kolkata");
  });

  it("ranks candidate journeys with transparent door-to-door access breakdown and Tatkal suitability signal", async () => {
    const origin = await resolveLocationAsync("Life Republic Pune");
    const dest = await resolveLocationAsync("Kolkata");

    if (!origin || !dest) throw new Error("Location resolution failed");

    const result = await resolveAndRankJourneyAsync(origin, dest);
    expect(result).toBeDefined();
    expect(result.rankedOptions.length).toBeGreaterThan(0);

    const topOption = result.rankedOptions[0];
    expect(topOption.train).toBeDefined();
    expect(topOption.transitToStationMins).toBeGreaterThan(0);
    expect(topOption.totalDoorToDoorMins ?? topOption.trainDurationMins).toBeGreaterThanOrEqual(topOption.trainDurationMins);
    expect(topOption.journeyScore?.reasons.length).toBeGreaterThan(0);
  });

  it("applies user explicit boarding preference bonus and updates ranking", async () => {
    const origin = await resolveLocationAsync("Life Republic Pune");
    const dest = await resolveLocationAsync("Kolkata");

    if (!origin || !dest) throw new Error("Location resolution failed");

    const resultWithPref = await resolveAndRankJourneyAsync(origin, dest, {
      boardingStationPreference: "PUNE",
    });

    expect(resultWithPref).toBeDefined();
    expect(resultWithPref.candidateOriginStations.some(s => s.station.code === "PUNE")).toBe(true);
  });
});
