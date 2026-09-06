import { describe, it, expect } from "vitest";
import type { Trip } from "@/types";
import type { CopilotContext } from "@/lib/copilot";
import {
  MockCallingProvider,
  RealCallingProvider,
  callingProvider,
} from "@/lib/calling/provider";
import { buildCallScript } from "@/lib/calling/script";
import { DEFAULT_WALLET } from "@/lib/payments";

const trip: Trip = {
  id: "trip_call_test",
  status: "upcoming",
  from: "Mumbai",
  fromCode: "CSMT",
  to: "Delhi",
  toCode: "NDLS",
  dateLabel: "Tomorrow",
  trainName: "12953 · August Kranti Rajdhani",
  travelClass: "3A",
  travellerIds: ["p1", "p2"],
  boardingStationName: "Borivali",
  arrivalDisplay: "09:45",
  fare: 2360,
  mode: "assisted",
  createdAt: new Date().toISOString(),
  agentState: "t_minus_30",
  agentEnabled: true,
  tatkalOpensAtLabel: "10:00 AM",
  primary: {
    optionId: "o1",
    trainName: "12953 · August Kranti Rajdhani",
    travelClass: "3A",
    boardingStationName: "Borivali",
    departureDisplay: "17:15",
    arrivalDisplay: "09:45",
    level: "High",
    fare: 2360,
  },
  backup: {
    optionId: "o2",
    trainName: "Split via Kota Junction",
    travelClass: "3A",
    boardingStationName: "Borivali",
    departureDisplay: "18:00",
    arrivalDisplay: "10:30",
    level: "Medium",
    fare: 2360,
    via: "Kota Junction",
  },
  readinessDone: ["authorized"],
  planNotifications: [],
};

const ctx: CopilotContext = { lang: "en", trip, wallet: { ...DEFAULT_WALLET } };

describe("CallingProvider abstraction (telephony boundary)", () => {
  it("the active provider is the mock — it dials nothing", async () => {
    expect(callingProvider.isReal).toBe(false);
    const placed = await callingProvider.placeCall({ reason: "check_in", tripId: trip.id });
    expect(placed.ok).toBe(true);
    expect(placed.simulated).toBe(true);
    expect(placed.sessionId).toBeTruthy();
  });

  it("the real provider fails honestly without a number, never fakes a call", async () => {
    const real = new RealCallingProvider();
    expect(real.isReal).toBe(true);
    const placed = await real.placeCall({ reason: "check_in" }); // no toNumber
    expect(placed.ok).toBe(false);
    expect(placed.simulated).toBe(false);
    expect(placed.error).toBeTruthy();
  });

  it("both providers satisfy the same interface (swappable)", () => {
    for (const p of [new MockCallingProvider(), new RealCallingProvider()]) {
      expect(typeof p.channelLabel).toBe("function");
      expect(typeof p.placeCall).toBe("function");
      expect(p.channelLabel("en").length).toBeGreaterThan(0);
    }
  });
});

describe("The call script is grounded through the shared Copilot tools", () => {
  it("the pre-Tatkal briefing states the real train, window, backup and fare coverage", () => {
    const script = buildCallScript(ctx, "Manoj", "en");
    const start = script.steps.start.text;
    expect(start).toContain("August Kranti Rajdhani"); // primary via get_recommendations
    expect(start).toContain("10:00 AM"); // window via get_tatkal_status
    expect(start).toContain("Kota Junction"); // backup via get_backup_option
    // Fare transparency (§17): 8450 wallet covers 2*2360 → mentioned.
    expect(start).toMatch(/Rail Wallet covers the fare/i);
  });

  it("with no active trip, the call offers to start one instead of inventing a journey", () => {
    const script = buildCallScript({ lang: "en" }, "Manoj", "en");
    expect(script.steps.start.text).toMatch(/don't have an active Tatkal plan/i);
    expect(script.steps.start.replies?.some((r) => r.action === "open_plan")).toBe(true);
  });

  it("the failure branch offers the backup and only navigates (never books)", () => {
    const failed = buildCallScript({ ...ctx, trip: { ...trip, agentState: "primary_failed" } }, "Manoj", "en");
    const replies = failed.steps.start.replies ?? [];
    expect(replies.some((r) => r.action === "open_trip")).toBe(true);
    expect(replies.every((r) => r.action === "open_trip" || r.action === undefined)).toBe(true);
  });
});
