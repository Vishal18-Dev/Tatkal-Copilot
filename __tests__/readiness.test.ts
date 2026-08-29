import { describe, it, expect } from "vitest";
import { calculateReadiness } from "@/lib/readiness";
import { TatkalAgent } from "@/lib/tatkal-agent";
import type { Trip } from "@/types";

const baseTrip: Trip = {
  id: "trip_readiness_test",
  status: "upcoming",
  from: "Mumbai CSMT",
  fromCode: "CSMT",
  to: "New Delhi",
  toCode: "NDLS",
  dateLabel: "Tomorrow",
  trainName: "12951 · Mumbai Rajdhani",
  travelClass: "3A",
  travellerIds: ["p1"],
  boardingStationName: "Mumbai CSMT",
  arrivalDisplay: "08:30",
  fare: 2150,
  mode: "auto",
  createdAt: new Date().toISOString(),
  agentState: "t_minus_10",
  agentEnabled: true,
  tatkalOpensAtLabel: "10:00 AM",
  primary: {
    optionId: "o1",
    trainName: "12951 · Mumbai Rajdhani",
    travelClass: "3A",
    boardingStationName: "Mumbai CSMT",
    departureDisplay: "17:00",
    arrivalDisplay: "08:30",
    level: "High",
    fare: 2150,
  },
  backup: {
    optionId: "o2",
    trainName: "12953 · August Kranti",
    travelClass: "3A",
    boardingStationName: "Mumbai CSMT",
    departureDisplay: "17:15",
    arrivalDisplay: "09:45",
    level: "Medium",
    fare: 2150,
  },
  readinessDone: ["authorized"],
  planNotifications: [],
  channelPreferences: { inApp: true, email: true, whatsappDemo: false },
};

describe("v1.6 Deterministic Readiness Engine & Agent Awareness Specification", () => {
  it("Scenario 1: All 6 readiness checks ready when fully configured", () => {
    const res = calculateReadiness(baseTrip);
    expect(res.readyCount).toBe(6);
    expect(res.totalCount).toBe(6);
    expect(res.isReady).toBe(true);
    expect(res.criticalReady).toBe(true);
    expect(res.summary).toBe("Ready to act");
    expect(res.blockingIds.length).toBe(0);
    expect(res.missingIds.length).toBe(0);
  });

  it("Scenario 2: No passengers -> passengers check not_ready, criticalReady = false", () => {
    const trip = { ...baseTrip, travellerIds: [] };
    const res = calculateReadiness(trip);
    const check = res.checks.find((c) => c.id === "passengers");
    expect(check?.status).toBe("not_ready");
    expect(res.criticalReady).toBe(false);
    expect(res.blockingIds).toContain("passengers");
  });

  it("Scenario 3: Missing train -> train check not_ready", () => {
    const trip = { ...baseTrip, primary: { ...baseTrip.primary, trainName: "" } };
    const res = calculateReadiness(trip);
    const check = res.checks.find((c) => c.id === "train");
    expect(check?.status).toBe("not_ready");
    expect(res.blockingIds).toContain("train");
  });

  it("Scenario 4: Missing backup -> backup check not_ready, operational missing", () => {
    const trip = { ...baseTrip, backup: null };
    const res = calculateReadiness(trip);
    const check = res.checks.find((c) => c.id === "backup");
    expect(check?.status).toBe("not_ready");
    expect(res.criticalReady).toBe(true); // backup is operational, not critical
    expect(res.missingIds).toContain("backup");
    expect(res.summary).toBe("1 operational item needs attention");
  });

  it("Scenario 5: Missing boarding station -> boarding check not_ready", () => {
    const trip = { ...baseTrip, primary: { ...baseTrip.primary, boardingStationName: "" } };
    const res = calculateReadiness(trip);
    const check = res.checks.find((c) => c.id === "boarding");
    expect(check?.status).toBe("not_ready");
    expect(res.blockingIds).toContain("boarding");
  });

  it("Scenario 6: Missing booking session -> booking_session check not_ready", () => {
    const trip = {
      ...baseTrip,
      agentState: "draft" as const,
      agentEnabled: false,
      mode: "assisted" as const,
      readinessDone: [],
    };
    const res = calculateReadiness(trip);
    const check = res.checks.find((c) => c.id === "booking_session");
    expect(check?.status).toBe("not_ready");
    expect(res.blockingIds).toContain("booking_session");
  });

  it("Scenario 7: Readiness count calculation", () => {
    const trip = { ...baseTrip, backup: null, travellerIds: [] };
    const res = calculateReadiness(trip);
    expect(res.readyCount).toBe(4);
    expect(res.totalCount).toBe(6);
    expect(res.summary).toBe("1 critical item needs attention");
  });

  it("Scenario 8: Readiness updates after trip state changes", () => {
    let trip: Trip = { ...baseTrip, travellerIds: [] };
    expect(calculateReadiness(trip).readyCount).toBe(5);

    // User selects passenger -> readyCount becomes 6
    trip = { ...trip, travellerIds: ["p1"] };
    expect(calculateReadiness(trip).readyCount).toBe(6);
  });

  it("Scenario 9: Agent receives structured readiness in observe()", () => {
    const agent = new TatkalAgent(baseTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const obs = agent.observe({
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    });

    expect(obs.readiness).toBeDefined();
    expect(obs.readiness?.readyCount).toBe(6);
    expect(obs.readiness?.isReady).toBe(true);
  });

  it("Scenario 10: Inactive user + fully ready -> notify_user", async () => {
    const agent = new TatkalAgent(baseTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const res = await agent.tick({
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    });

    expect(res.decision.action).toBe("notify_user");
  });

  it("Scenario 11: Active user + fully ready -> none", async () => {
    const agent = new TatkalAgent(baseTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const res = await agent.tick({
      event: "monitoring_started",
      secondsRemaining: 1800,
      countdownLabel: "30:00",
      description: "Passenger active",
      windowOpen: false,
      userActive: true,
      primaryAvailable: true,
    });

    expect(res.decision.action).toBe("none");
  });

  it("Scenario 12: Inactive user + missing critical prerequisite -> appropriate escalation", async () => {
    const unreadyTrip = {
      ...baseTrip,
      travellerIds: [],
    };
    const agent = new TatkalAgent(unreadyTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const res = await agent.tick({
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    });

    expect(res.decision.action).toBe("notify_user");
  });

  it("Scenario 13: Primary failure + backup available -> activate_backup", async () => {
    const agent = new TatkalAgent(baseTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const res = await agent.tick({
      event: "primary_unavailable",
      secondsRemaining: 0,
      countdownLabel: "LIVE",
      description: "Primary quota exhausted",
      windowOpen: true,
      userActive: true,
      primaryAvailable: false,
    });

    expect(res.decision.action).toBe("activate_backup");
  });

  it("Scenario 14: Primary failure + no backup -> notify_user (does NOT activate backup)", async () => {
    const noBackupTrip = { ...baseTrip, backup: null };
    const agent = new TatkalAgent(noBackupTrip, {
      updateTrip: () => {},
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const res = await agent.tick({
      event: "primary_unavailable",
      secondsRemaining: 0,
      countdownLabel: "LIVE",
      description: "Primary quota exhausted",
      windowOpen: true,
      userActive: true,
      primaryAvailable: false,
    });

    expect(res.decision.action).toBe("notify_user");
    expect(res.decision.action).not.toBe("activate_backup");
  });

  it("Scenario 15: Deterministic calculateReadiness identifies exact missing items", () => {
    const incompleteTrip = { ...baseTrip, backup: null, travellerIds: [] };
    const res = calculateReadiness(incompleteTrip);
    expect(res.missingIds).toEqual(["passengers", "backup"]);
    expect(res.blockingIds).toEqual(["passengers"]);
  });
});
