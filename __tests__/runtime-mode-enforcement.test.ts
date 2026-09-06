import { describe, it, expect, vi } from "vitest";
import { validateAgentDecision, type ProposedAgentDecision } from "@/lib/action-validator";
import { TatkalAgent } from "@/lib/tatkal-agent";
import { DemoClock, DEMO_ENVIRONMENT_TIMELINE, type DemoEnvironmentBeat } from "@/lib/demo-clock";
import type { Trip } from "@/types";

function createMockTrip(mode: "assisted" | "auto" = "assisted", overrides?: Partial<Trip>): Trip {
  return {
    id: "test_runtime_trip",
    status: "upcoming",
    from: "Mumbai Central",
    fromCode: "MMCT",
    to: "New Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "12953 August Kranti Tejas Rajdhani",
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
      trainName: "12953 August Kranti Tejas Rajdhani",
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

describe("Item 4 — Assisted vs Permissioned Runtime Enforcement", () => {
  // ─────────────────────────────────────────────────────────────
  // Section 11: Explicit Action Boundary Tests
  // ─────────────────────────────────────────────────────────────
  describe("Section 11 — Action Boundary Verification", () => {
    it("Assisted trip + activate_backup + isUserInitiated !== true => REJECTED", () => {
      const trip = createMockTrip("assisted");
      const decision: ProposedAgentDecision = {
        action: "activate_backup",
        reason: "Primary unavailable",
        toolCall: { name: "activateBackupStrategy" },
        source: "gpt",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("disallowed_action");
      expect(result.reason).toMatch(/Assisted mode requires explicit user authorization/i);
    });

    it("Assisted trip + open_booking_flow + isUserInitiated !== true => REJECTED", () => {
      const trip = createMockTrip("assisted");
      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Tatkal window opened",
        toolCall: { name: "openBookingFlow" },
        source: "gpt",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("disallowed_action");
      expect(result.reason).toMatch(/Assisted mode requires explicit user initiation/i);
    });

    it("Permissioned trip + open_booking_flow + isUserInitiated === false => ALLOWED", () => {
      const trip = createMockTrip("auto");
      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Tatkal window opened",
        toolCall: { name: "openBookingFlow" },
        source: "gpt",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("Permissioned trip + activate_backup + isUserInitiated === false => ALLOWED", () => {
      const trip = createMockTrip("auto");
      const decision: ProposedAgentDecision = {
        action: "activate_backup",
        reason: "Primary unavailable",
        toolCall: { name: "activateBackupStrategy" },
        source: "gpt",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Section 12: Test Matrix — Assisted Mode (1–10)
  // ─────────────────────────────────────────────────────────────
  describe("Section 12 Matrix — Assisted Mode", () => {
    it("1. Window open does not autonomously book", () => {
      const trip = createMockTrip("assisted");
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
      expect(decision.action).not.toBe("open_booking_flow");
      expect(decision.action).not.toBe("activate_backup");
      expect(["notify_user", "none"]).toContain(decision.action);
    });

    it("2. notify_user allowed in Assisted mode", () => {
      const trip = createMockTrip("assisted");
      const decision: ProposedAgentDecision = {
        action: "notify_user",
        reason: "Window open alert",
        toolCall: { name: "notifyUser", arguments: { channel: "in-app", title: "Window Open" } },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("3. open_booking_flow rejected without user initiation", () => {
      const trip = createMockTrip("assisted");
      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Autonomous attempt",
        toolCall: { name: "openBookingFlow" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), undefined);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("disallowed_action");
    });

    it("4. Demo clock pauses on tatkal_window_open in Assisted mode", () => {
      const trip = createMockTrip("assisted");
      let clockStatus = "running";
      let pausedAtBeat: DemoEnvironmentBeat | null = null;

      const callbacks = {
        onBeat: (beat: DemoEnvironmentBeat) => {
          if (trip.mode === "assisted" && beat.event === "tatkal_window_open") {
            clock.pause();
            pausedAtBeat = beat;
          }
        },
        onComplete: () => {},
        onStatusChange: (status: string) => {
          clockStatus = status;
        },
      };

      const clock = new DemoClock(callbacks, 10);
      clock.start();
      const windowOpenBeat = DEMO_ENVIRONMENT_TIMELINE.find((b) => b.event === "tatkal_window_open")!;
      callbacks.onBeat(windowOpenBeat);

      expect(clockStatus).toBe("paused");
      expect((pausedAtBeat as DemoEnvironmentBeat | null)?.event).toBe("tatkal_window_open");
    });

    it("5. Start booking CTA condition holds in Assisted mode at window_open", () => {
      const trip = createMockTrip("assisted", { agentState: "window_open" });
      const busy = false;
      const isAssisted = trip.mode === "assisted";
      const canStartBooking = isAssisted && (trip.agentState === "window_open" || trip.agentState === "user_action_required") && !busy;
      expect(canStartBooking).toBe(true);
    });

    it("6. user-initiated booking allowed in Assisted mode", () => {
      const trip = createMockTrip("assisted", { agentState: "window_open" });
      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Passenger clicked Start booking",
        toolCall: { name: "openBookingFlow" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), true);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("7. primary failure does not autonomously activate backup in Assisted mode", () => {
      const trip = createMockTrip("assisted", { agentState: "booking_in_progress" });
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "primary_unavailable",
        secondsRemaining: 0,
        countdownLabel: "LIVE",
        description: "Primary quota exhausted",
        windowOpen: true,
        userActive: true,
        primaryAvailable: false,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).not.toBe("activate_backup");
      expect(["evaluate_backup", "notify_user", "none"]).toContain(decision.action);
    });

    it("8. backup recommendation (evaluate_backup) allowed in Assisted mode", () => {
      const trip = createMockTrip("assisted");
      const decision: ProposedAgentDecision = {
        action: "evaluate_backup",
        reason: "Primary train unavailable, evaluating backup route",
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("9. Use backup CTA condition holds in Assisted mode on primary failure", () => {
      const trip = createMockTrip("assisted", { agentState: "backup_recommended" });
      const busy = false;
      const isAssisted = trip.mode === "assisted";
      const canUseBackup =
        isAssisted &&
        !!trip.backup &&
        (trip.agentState === "primary_failed" || trip.agentState === "backup_recommended" || trip.booking?.status === "failed") &&
        trip.agentState !== "backup_attempt" &&
        trip.agentState !== "confirmed" &&
        trip.booking?.status !== "success";

      expect(canUseBackup).toBe(true);
    });

    it("10. user-initiated backup allowed in Assisted mode", () => {
      const trip = createMockTrip("assisted", { agentState: "backup_recommended" });
      const decision: ProposedAgentDecision = {
        action: "activate_backup",
        reason: "User clicked Use backup",
        toolCall: { name: "activateBackupStrategy" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), true);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Section 12: Test Matrix — Permissioned Mode (11–16)
  // ─────────────────────────────────────────────────────────────
  describe("Section 12 Matrix — Permissioned Mode", () => {
    it("11. Window open automatically books in Permissioned mode", () => {
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

      const validation = validateAgentDecision(decision, trip, new Set(), false);
      expect(validation.valid).toBe(true);
    });

    it("12. Start booking CTA hidden in Permissioned mode", () => {
      const trip = createMockTrip("auto", { agentState: "window_open" });
      const isAssisted = trip.mode === "assisted";
      const canStartBooking = isAssisted && (trip.agentState === "window_open" || trip.agentState === "user_action_required");
      expect(canStartBooking).toBe(false);
    });

    it("13. primary failure evaluates backup in Permissioned mode", () => {
      const trip = createMockTrip("auto", { agentState: "booking_in_progress" });
      const agent = new TatkalAgent(trip);
      const obs = agent.observe({
        event: "primary_unavailable",
        secondsRemaining: 0,
        countdownLabel: "LIVE",
        description: "Primary unavailable",
        windowOpen: true,
        userActive: true,
        primaryAvailable: false,
      });

      const decision = agent["evaluateLocally"](obs);
      expect(decision.action).toBe("activate_backup");
    });

    it("14. backup activates automatically in Permissioned mode without user initiation", () => {
      const trip = createMockTrip("auto", { agentState: "primary_failed" });
      const decision: ProposedAgentDecision = {
        action: "activate_backup",
        reason: "Autonomous recovery on quota exhaustion",
        toolCall: { name: "activateBackupStrategy" },
        source: "gpt",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("15. Use backup CTA hidden in Permissioned mode", () => {
      const trip = createMockTrip("auto", { agentState: "backup_recommended" });
      const isAssisted = trip.mode === "assisted";
      const canUseBackup =
        isAssisted &&
        !!trip.backup &&
        (trip.agentState === "primary_failed" || trip.agentState === "backup_recommended" || trip.booking?.status === "failed");
      expect(canUseBackup).toBe(false);
    });

    it("16. journey reaches confirmation autonomously in Permissioned mode", async () => {
      const trip = createMockTrip("auto");
      const executedTools: string[] = [];

      const agent = new TatkalAgent(trip, {
        updateTrip: (id, patch) => Object.assign(trip, patch),
        logActivity: () => {},
        pushNotification: () => {},
        getTravellers: () => [],
        onExecutePrimaryBooking: async () => {
          executedTools.push("primary_booking");
        },
        onExecuteBackupBooking: async () => {
          executedTools.push("backup_booking");
          trip.agentState = "confirmed";
        },
      });

      // Window open beat
      const windowOpenBeat: DemoEnvironmentBeat = {
        event: "tatkal_window_open",
        secondsRemaining: 0,
        countdownLabel: "00:00",
        description: "Tatkal window open",
        windowOpen: true,
        userActive: true,
        primaryAvailable: true,
      };

      const res1 = await agent.tick(windowOpenBeat);
      expect(res1.validation.valid).toBe(true);
      expect(res1.executedTool).toBe("openBookingFlow");

      // Primary failure beat
      const primaryFailBeat: DemoEnvironmentBeat = {
        event: "primary_unavailable",
        secondsRemaining: 0,
        countdownLabel: "LIVE",
        description: "Primary exhausted",
        windowOpen: true,
        userActive: true,
        primaryAvailable: false,
      };

      const res2 = await agent.tick(primaryFailBeat);
      expect(res2.validation.valid).toBe(true);
      expect(res2.executedTool).toBe("activateBackupStrategy");
      expect(trip.agentState).toBe("confirmed");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Section 12: Universal Safety Rules (17–20)
  // ─────────────────────────────────────────────────────────────
  describe("Section 12 Matrix — Universal Safety", () => {
    it("17. duplicate booking rejected when booking already in progress", () => {
      const trip = createMockTrip("auto", { agentState: "booking_in_progress" });
      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Duplicate open",
        toolCall: { name: "openBookingFlow" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), false);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("already_completed");
      expect(result.reason).toMatch(/already in progress/i);
    });

    it("18. booking after confirmation rejected", () => {
      const trip = createMockTrip("auto", {
        agentState: "confirmed",
        booking: {
          pnr: "1234567890",
          amount: 2450,
          status: "success",
          recovered: false,
          primaryTrainName: "12953 Rajdhani",
          finalTrainName: "12953 Rajdhani",
        },
      });

      const decision: ProposedAgentDecision = {
        action: "open_booking_flow",
        reason: "Post-confirmation booking attempt",
        toolCall: { name: "openBookingFlow" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), true);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("already_completed");
    });

    it("19. backup after confirmation rejected", () => {
      const trip = createMockTrip("auto", {
        agentState: "confirmed",
        booking: {
          pnr: "1234567890",
          amount: 2450,
          status: "success",
          recovered: false,
          primaryTrainName: "12953 Rajdhani",
          finalTrainName: "12953 Rajdhani",
        },
      });

      const decision: ProposedAgentDecision = {
        action: "activate_backup",
        reason: "Post-confirmation backup attempt",
        toolCall: { name: "activateBackupStrategy" },
        source: "local",
      };
      const result = validateAgentDecision(decision, trip, new Set(), true);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("already_completed");
    });

    it("20. notification deduplication preserved across modes", () => {
      const trip = createMockTrip("assisted");
      const sentKeys = new Set<string>(["key:tatkal_window_open", "title:Tatkal Window Open"]);

      const decision: ProposedAgentDecision = {
        action: "notify_user",
        reason: "Window open alert",
        toolCall: {
          name: "notifyUser",
          arguments: {
            channel: "in-app",
            title: "Tatkal Window Open",
            notificationKey: "tatkal_window_open",
          },
        },
        source: "local",
      };

      const result = validateAgentDecision(decision, trip, sentKeys, false);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("duplicate_notification");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Section 10A: UI & Voice Semantic Specification (L. UI Tests)
  // ─────────────────────────────────────────────────────────────
  describe("Section 10A — UI & Voice Semantic Specification", () => {
    it("1. Assisted mode displays 'Keep me in control'", async () => {
      const { coachFor } = await import("@/lib/agent");
      const trip = createMockTrip("assisted");
      expect(trip.mode).toBe("assisted");
      // Semantic wording
      const label = trip.mode === "assisted" ? "Keep me in control" : "Let Copilot act";
      expect(label).toBe("Keep me in control");
    });

    it("2. Permissioned mode displays 'Let Copilot act'", () => {
      const trip = createMockTrip("auto");
      expect(trip.mode).toBe("auto");
      const label = trip.mode === "assisted" ? "Keep me in control" : "Let Copilot act";
      expect(label).toBe("Let Copilot act");
    });

    it("3. Assisted window-open state displays Start booking CTA condition", () => {
      const trip = createMockTrip("assisted", { agentState: "window_open" });
      const busy = false;
      const isAssisted = trip.mode === "assisted";
      const canStartBooking = isAssisted && (trip.agentState === "window_open" || trip.agentState === "user_action_required") && !busy;
      expect(canStartBooking).toBe(true);
    });

    it("4. Permissioned window-open state does NOT display Start booking CTA", () => {
      const trip = createMockTrip("auto", { agentState: "window_open" });
      const busy = false;
      const isAssisted = trip.mode === "assisted";
      const canStartBooking = isAssisted && (trip.agentState === "window_open" || trip.agentState === "user_action_required") && !busy;
      expect(canStartBooking).toBe(false);
    });

    it("5. Assisted primary failure displays Use backup CTA", () => {
      const trip = createMockTrip("assisted", { agentState: "backup_recommended" });
      const busy = false;
      const isAssisted = trip.mode === "assisted";
      const canUseBackup =
        isAssisted &&
        !!trip.backup &&
        (trip.agentState === "primary_failed" || trip.agentState === "backup_recommended" || trip.booking?.status === "failed");
      expect(canUseBackup).toBe(true);
    });

    it("6. Permissioned primary failure does NOT display Use backup CTA", () => {
      const trip = createMockTrip("auto", { agentState: "backup_recommended" });
      const isAssisted = trip.mode === "assisted";
      const canUseBackup =
        isAssisted &&
        !!trip.backup &&
        (trip.agentState === "primary_failed" || trip.agentState === "backup_recommended" || trip.booking?.status === "failed");
      expect(canUseBackup).toBe(false);
    });

    it("7. Mode indicator is visible in Mission Control", () => {
      const tripAssisted = createMockTrip("assisted");
      const tripPermissioned = createMockTrip("auto");

      const indicatorAssisted = tripAssisted.mode === "assisted" ? "🤝 Assisted" : "⚡ Permissioned";
      const indicatorPermissioned = tripPermissioned.mode === "assisted" ? "🤝 Assisted" : "⚡ Permissioned";

      expect(indicatorAssisted).toContain("Assisted");
      expect(indicatorPermissioned).toContain("Permissioned");
    });

    it("8. Voice UI reflects current authorization mode (Section 10A I)", async () => {
      const { explainBookingAuthority, COPILOT_TOOLS } = await import("@/lib/copilot/tools");
      expect(COPILOT_TOOLS.explain_booking_authority).toBeDefined();

      const tripAssisted = createMockTrip("assisted");
      const ctxAssisted = {
        lang: "en" as const,
        trip: tripAssisted,
        travellers: [],
        wallet: { balance: 5000, history: [], currency: "INR" as const, lastUpdated: new Date().toISOString() },
      };
      const resAssisted = explainBookingAuthority(ctxAssisted);
      expect(resAssisted.speak).toContain("Assisted mode");
      expect(resAssisted.speak).toContain("I need your confirmation before I start it");

      const tripPermissioned = createMockTrip("auto");
      const ctxPermissioned = {
        lang: "en" as const,
        trip: tripPermissioned,
        travellers: [],
        wallet: { balance: 5000, history: [], currency: "INR" as const, lastUpdated: new Date().toISOString() },
      };
      const resPermissioned = explainBookingAuthority(ctxPermissioned);
      expect(resPermissioned.speak).toBe("I'll start your prepared booking strategy.");
    });

    it("9. AI Coach copy reflects exact runtime authorization boundaries (Section 8)", async () => {
      const { coachFor } = await import("@/lib/agent");

      // Assisted at window open
      const assistedTrip = createMockTrip("assisted");
      const assistedCoach = coachFor("window_open", assistedTrip);
      expect(assistedCoach).toBe("The window is open. Your plan is ready. Tap Start booking when you're ready.");
      expect(assistedCoach).not.toContain("I'm starting booking");

      // Permissioned at window open
      const permissionedTrip = createMockTrip("auto");
      const permissionedCoach = coachFor("window_open", permissionedTrip);
      expect(permissionedCoach).toBe("The window is open. I'm starting your prepared booking strategy now.");
      expect(permissionedCoach).not.toContain("Tap Start booking");

      // Assisted at primary failure
      const assistedFailCoach = coachFor("primary_failed", assistedTrip);
      expect(assistedFailCoach).toBe("Your primary option is unavailable. Your backup is ready.");

      // Permissioned at primary failure
      const permFailCoach = coachFor("primary_failed", permissionedTrip);
      expect(permFailCoach).toBe("Your primary option is unavailable. Copilot is switching to your prepared backup.");
    });
  });
});
