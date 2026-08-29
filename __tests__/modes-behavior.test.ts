import { describe, it, expect } from "vitest";
import { TatkalAgent } from "@/lib/tatkal-agent";
import { validateAgentDecision } from "@/lib/action-validator";
import { DemoClock, DEMO_ENVIRONMENT_TIMELINE } from "@/lib/demo-clock";
import type { Trip } from "@/types";

function createMockTrip(mode: "assisted" | "auto" = "assisted", overrides?: Partial<Trip>): Trip {
  return {
    id: "test_trip_mode",
    status: "upcoming",
    from: "Mumbai Central",
    fromCode: "MMCT",
    to: "New Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "August Kranti Rajdhani",
    travelClass: "3A",
    travellerIds: ["p1", "p2"],
    boardingStationName: "Borivali",
    arrivalDisplay: "08:30 · tomorrow",
    fare: 2450,
    mode,
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    arrivalTargetLabel: "before 08:30",
    primary: {
      optionId: "opt_primary",
      trainName: "August Kranti Rajdhani",
      travelClass: "3A",
      boardingStationName: "Borivali",
      departureDisplay: "17:05",
      arrivalDisplay: "08:30 · tomorrow",
      level: "High",
      fare: 2450,
    },
    backup: {
      optionId: "opt_backup",
      trainName: "Split via Kota Junction",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "16:35",
      arrivalDisplay: "12:20 · tomorrow",
      level: "Very High",
      fare: 2600,
      via: "Kota Junction",
    },
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Tatkal Copilot Agent Modes Specification (Assisted vs Permissioned)", () => {
  describe("Assisted Mode Requirements", () => {
    it("1. Assisted + window open → no automatic booking decision locally", () => {
      const trip = createMockTrip("assisted");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "tatkal_window_open",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Tatkal window is open",
        windowOpen: true,
        userActive: true,
        primaryAvailable: true,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).not.toBe("open_booking_flow");
      expect(decision.action).toBe("notify_user");
    });

    it("2. Assisted + window open + user inactive → notify user escalation", () => {
      const trip = createMockTrip("assisted");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "tatkal_window_open",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Tatkal window open · User inactive",
        windowOpen: true,
        userActive: false,
        primaryAvailable: true,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).toBe("notify_user");
      expect(decision.toolCall?.name).toBe("notifyUser");
    });

    it("3. Assisted + primary failure → recommends backup without auto-activation", () => {
      const trip = createMockTrip("assisted");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "primary_unavailable",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Primary train unavailable",
        windowOpen: true,
        userActive: true,
        primaryAvailable: false,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).not.toBe("activate_backup");
      expect(decision.action).toBe("notify_user");
      expect(decision.toolCall?.arguments?.notificationKey).toBe("assisted_primary_failed");
    });

    it("4. Assisted + user clicks Start booking → open_booking_flow validated with user initiation", () => {
      const trip = createMockTrip("assisted");
      const res = validateAgentDecision(
        { action: "open_booking_flow", reason: "User clicked Start booking", source: "local" },
        trip,
        new Set(),
        true
      );
      expect(res.valid).toBe(true);
      expect(res.code).toBe("ok");
    });

    it("5. Assisted + user clicks Use backup → activate_backup validated with user initiation", () => {
      const trip = createMockTrip("assisted");
      const res = validateAgentDecision(
        { action: "activate_backup", reason: "User clicked Use backup", source: "local" },
        trip,
        new Set(),
        true
      );
      expect(res.valid).toBe(true);
      expect(res.code).toBe("ok");
    });
  });

  describe("Permissioned (Auto) Mode Requirements", () => {
    it("6. Permissioned + window open → automatic open_booking_flow decision", () => {
      const trip = createMockTrip("auto");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "tatkal_window_open",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Tatkal window open",
        windowOpen: true,
        userActive: true,
        primaryAvailable: true,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).toBe("open_booking_flow");
      expect(decision.toolCall?.name).toBe("openBookingFlow");
    });

    it("7. Permissioned + user inactive → booking still starts when window opens", () => {
      const trip = createMockTrip("auto");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "tatkal_window_open",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Tatkal window open · User inactive",
        windowOpen: true,
        userActive: false,
        primaryAvailable: true,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).toBe("open_booking_flow");
    });

    it("8. Permissioned + primary failure → evaluates & activates backup strategy", () => {
      const trip = createMockTrip("auto");
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "primary_unavailable",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Primary train unavailable",
        windowOpen: true,
        userActive: false,
        primaryAvailable: false,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).toBe("activate_backup");
      expect(decision.toolCall?.name).toBe("activateBackupStrategy");
    });

    it("9. Permissioned + confirmed → blocks duplicate booking attempt", () => {
      const trip = createMockTrip("auto", { agentState: "confirmed" });
      const res = validateAgentDecision(
        { action: "open_booking_flow", reason: "Attempting again", source: "local" },
        trip,
        new Set(),
        false
      );
      expect(res.valid).toBe(false);
      expect(res.code).toBe("already_completed");
    });

    it("10. Permissioned + booking in progress → blocks duplicate booking flow", () => {
      const trip = createMockTrip("auto", { agentState: "booking_in_progress" });
      const res = validateAgentDecision(
        { action: "open_booking_flow", reason: "Attempting again", source: "local" },
        trip,
        new Set(),
        false
      );
      expect(res.valid).toBe(false);
      expect(res.code).toBe("already_completed");
    });
  });

  describe("Shared & Architectural Safety Rules", () => {
    it("11. Demo clock remains purely environmental and contains no decision logic", () => {
      expect(DEMO_ENVIRONMENT_TIMELINE.length).toBeGreaterThan(0);
      DEMO_ENVIRONMENT_TIMELINE.forEach((beat) => {
        expect(beat).toHaveProperty("event");
        expect(beat).toHaveProperty("description");
        expect(beat).not.toHaveProperty("action");
      });
    });

    it("12. Action validator suppresses duplicate notifications", () => {
      const trip = createMockTrip("assisted");
      const sentKeys = new Set<string>(["key:tatkal_warning_10m"]);
      const res = validateAgentDecision(
        {
          action: "notify_user",
          reason: "Warning",
          toolCall: { name: "notifyUser", arguments: { notificationKey: "tatkal_warning_10m" } },
          source: "local",
        },
        trip,
        sentKeys
      );
      expect(res.valid).toBe(false);
      expect(res.code).toBe("duplicate_notification");
    });
  });
});
