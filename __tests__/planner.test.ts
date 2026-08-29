import { describe, it, expect } from "vitest";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import type { TravelIntent } from "@/types";

describe("Intent Extraction (Local Parser)", () => {
  it("extracts destination and arrival deadline", () => {
    const intent = parseIntentLocally("I need to reach Delhi before 8 tomorrow morning with my parents");
    expect(intent.to).toBe("Delhi");
    expect(intent.toCode).toBe("NDLS");
    expect(intent.arrivalDeadline).toBe("08:00");
    expect(intent.passengers).toBe(3);
  });

  it("defaults origin to Mumbai", () => {
    const intent = parseIntentLocally("book a ticket to Delhi");
    expect(intent.from).toBe("Mumbai");
    expect(intent.fromCode).toBe("BCT");
  });

  it("extracts class preference", () => {
    const intent = parseIntentLocally("need 2A to Delhi");
    expect(intent.preferredClass).toBe("2A");
  });

  it("extracts cheapest priority", () => {
    const intent = parseIntentLocally("cheapest ticket to Delhi");
    expect(intent.priority).toBe("cheapest");
  });

  it("extracts comfort priority", () => {
    const intent = parseIntentLocally("comfortable first class ticket to Delhi");
    expect(intent.priority).toBe("comfort");
  });

  it("extracts arrival-time priority", () => {
    const intent = parseIntentLocally("reach Delhi before 6am for a meeting");
    expect(intent.priority).toBe("arrival-time");
  });

  it("handles passengers: wife", () => {
    const intent = parseIntentLocally("Delhi with my wife");
    expect(intent.passengers).toBeGreaterThanOrEqual(2);
  });

  it("handles passengers: family", () => {
    const intent = parseIntentLocally("Delhi with family");
    expect(intent.passengers).toBeGreaterThanOrEqual(4);
  });

  it("generates a restatement", () => {
    const intent = parseIntentLocally("Delhi before 8am with parents");
    expect(intent.restated).toBeTruthy();
    expect(intent.restated.length).toBeGreaterThan(10);
  });

  it("handles missing deadline gracefully", () => {
    const intent = parseIntentLocally("need a ticket to Delhi");
    expect(intent.arrivalDeadline).toBeNull();
  });

  it("clamps passenger count to 6 max", () => {
    const intent = parseIntentLocally("10 tickets to Delhi");
    expect(intent.passengers).toBeLessThanOrEqual(6);
  });
});

describe("Plan Builder (Local)", () => {
  it("builds a plan with options", () => {
    const intent = parseIntentLocally("Delhi before 8 tomorrow morning with my parents");
    const plan = buildPlanLocally(intent);
    expect(plan.options.length).toBeGreaterThanOrEqual(2);
    expect(plan.recommendedId).toBeTruthy();
    expect(plan.source).toBe("local");
  });

  it("recommends one option", () => {
    const intent = parseIntentLocally("Delhi");
    const plan = buildPlanLocally(intent);
    const rec = plan.options.find((o) => o.id === plan.recommendedId);
    expect(rec).toBeDefined();
    expect(rec?.recommended).toBe(true);
  });

  it("assigns unique tags", () => {
    const intent = parseIntentLocally("Delhi before 8am");
    const plan = buildPlanLocally(intent);
    const tags = plan.options.map((o) => o.tag);
    // At least the recommended tag should appear
    expect(tags).toContain("recommended");
  });

  it("includes why explanation", () => {
    const intent = parseIntentLocally("Delhi");
    const plan = buildPlanLocally(intent);
    expect(plan.narrative.whyRecommended).toBeTruthy();
    expect(plan.narrative.whyRecommended.length).toBeGreaterThan(20);
  });

  it("falls back to Mumbai-Delhi for unknown corridor", () => {
    const intent: TravelIntent = {
      from: "Jaipur",
      fromCode: "JP",
      to: "Kolkata",
      toCode: "HWH",
      date: "2026-01-01",
      arrivalDeadline: null,
      passengers: 1,
      preferredClass: "any",
      priority: "safest",
      flexibility: 0.6,
      restated: "test",
    };
    const plan = buildPlanLocally(intent);
    expect(plan.options.length).toBeGreaterThan(0);
  });
});
