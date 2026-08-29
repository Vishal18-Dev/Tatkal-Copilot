import { describe, it, expect, vi } from "vitest";
import { TatkalAgent, type AgentCallbacks } from "@/lib/tatkal-agent";
import type { Trip, ActivityEvent } from "@/types";

function makeMockTrip(overrides?: Partial<Trip>): Trip {
  return {
    id: "trip_test",
    status: "upcoming",
    from: "Mumbai",
    fromCode: "BCT",
    to: "Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "August Kranti Rajdhani",
    travelClass: "3A",
    travellerIds: ["t1", "t2"],
    boardingStationName: "Borivali",
    arrivalDisplay: "06:40 · tomorrow",
    fare: 2360,
    mode: "assisted",
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    arrivalTargetLabel: "before 08:00",
    primary: {
      optionId: "12953-3A",
      trainName: "August Kranti Rajdhani",
      travelClass: "3A",
      boardingStationName: "Borivali",
      departureDisplay: "16:35",
      arrivalDisplay: "06:40 · tomorrow",
      level: "High",
      fare: 2360,
    },
    backup: {
      optionId: "split-KOTA",
      trainName: "Split via Kota Junction",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "16:35",
      arrivalDisplay: "12:20 · tomorrow",
      level: "Very High",
      fare: 2540,
      via: "Kota Junction",
    },
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockCallbacks(): AgentCallbacks & {
  updatedTrips: Partial<Trip>[];
  loggedEvents: Omit<ActivityEvent, "id" | "at">[][];
  notifications: { title: string; body: string }[];
  primaryBookingExecuted: boolean;
  backupBookingExecuted: boolean;
} {
  const updatedTrips: Partial<Trip>[] = [];
  const loggedEvents: Omit<ActivityEvent, "id" | "at">[][] = [];
  const notifications: { title: string; body: string }[] = [];
  let primaryBookingExecuted = false;
  let backupBookingExecuted = false;

  return {
    updatedTrips,
    loggedEvents,
    notifications,
    primaryBookingExecuted,
    backupBookingExecuted,
    updateTrip: (_id, patch) => updatedTrips.push(patch),
    logActivity: (events) => loggedEvents.push(events),
    pushNotification: (n) => notifications.push(n),
    getTravellers: () => [],
    onExecutePrimaryBooking: async () => { primaryBookingExecuted = true; },
    onExecuteBackupBooking: async () => { backupBookingExecuted = true; },
  };
}

describe("TatkalAgent (v1.4 Decision Loop)", () => {
  describe("Observation", () => {
    it("observe gathers environmental facts and trip state", () => {
      const trip = makeMockTrip();
      const agent = new TatkalAgent(trip, makeMockCallbacks());
      const obs = agent.observe({
        event: "user_inactive",
        secondsRemaining: 5,
        countdownLabel: "05:00",
        description: "Passenger inactive",
        windowOpen: false,
        userActive: false,
        primaryAvailable: true,
      });

      expect(obs.journeyState).toBe("scheduled");
      expect(obs.userActive).toBe(false);
      expect(obs.secondsRemaining).toBe(5);
      expect(obs.selectedTrain?.trainName).toBe("August Kranti Rajdhani");
    });
  });

  describe("Decision & Validation", () => {
    it("act executes notifyUser when decision is notify_user", async () => {
      const trip = makeMockTrip();
      const cb = makeMockCallbacks();
      const agent = new TatkalAgent(trip, cb);

      const decision = {
        action: "notify_user" as const,
        reason: "User inactive shortly before Tatkal window.",
        toolCall: { name: "notifyUser" as const, arguments: { channel: "whatsapp" as const, title: "Alert", message: "Open app" } },
        source: "local" as const,
      };

      const res = await agent.act(decision);
      expect(res.validation.valid).toBe(true);
      expect(res.executedTool).toBe("notifyUser");
      expect(cb.notifications.length).toBe(1);
    });

    it("act rejects invalid activate_backup decision when no backup exists", async () => {
      const trip = makeMockTrip({ backup: null });
      const cb = makeMockCallbacks();
      const agent = new TatkalAgent(trip, cb);

      const decision = {
        action: "activate_backup" as const,
        reason: "Try backup",
        toolCall: { name: "activateBackupStrategy" as const },
        source: "gpt" as const,
      };

      const res = await agent.act(decision);
      expect(res.validation.valid).toBe(false);
      expect(res.validation.code).toBe("missing_backup");
      expect(res.executedTool).toBeUndefined();
    });
  });

  describe("Tool Execution Ownership", () => {
    it("openBookingFlow mutates agentState to booking_in_progress", async () => {
      const trip = makeMockTrip();
      const cb = makeMockCallbacks();
      const agent = new TatkalAgent(trip, cb);

      await agent.openBookingFlow();
      expect(cb.updatedTrips.some((patch) => patch.agentState === "booking_in_progress")).toBe(true);
    });

    it("activateBackupStrategy mutates agentState to backup_attempt", async () => {
      const trip = makeMockTrip();
      const cb = makeMockCallbacks();
      const agent = new TatkalAgent(trip, cb);

      await agent.activateBackupStrategy();
      expect(cb.updatedTrips.some((patch) => patch.agentState === "backup_attempt")).toBe(true);
    });
  });
});
