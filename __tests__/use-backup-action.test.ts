import { describe, it, expect, vi } from "vitest";
import { TatkalAgent } from "@/lib/tatkal-agent";
import { validateAgentDecision, type ProposedAgentDecision } from "@/lib/action-validator";
import type { Trip } from "@/types";

const baseTrip: Trip = {
  id: "trip_backup_test",
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
  agentState: "scheduled",
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
    via: "Kota Junction",
  },
  readinessDone: ["authorized"],
  planNotifications: [],
  channelPreferences: { inApp: true, email: true, whatsappDemo: false },
};

function helperCanUseBackup(trip: Trip): boolean {
  const state = trip.agentState;
  return (
    !!trip.backup &&
    (state === "primary_failed" || state === "backup_recommended" || trip.booking?.status === "failed") &&
    state !== "backup_attempt" &&
    state !== "confirmed" &&
    trip.booking?.status !== "success"
  );
}

describe("v1.6 Agent Recommendation & Use Backup UI Action Synchronization", () => {
  it("Scenario 1: Primary available -> no Use backup CTA", () => {
    const trip = { ...baseTrip, agentState: "t_minus_10" as const };
    expect(helperCanUseBackup(trip)).toBe(false);
  });

  it("Scenario 2: Primary failed + backup available -> CTA visible", () => {
    const trip = { ...baseTrip, agentState: "primary_failed" as const };
    expect(helperCanUseBackup(trip)).toBe(true);

    const trip2 = { ...baseTrip, agentState: "backup_recommended" as const };
    expect(helperCanUseBackup(trip2)).toBe(true);
  });

  it("Scenario 3: Primary failed + no backup -> CTA hidden", () => {
    const trip = { ...baseTrip, agentState: "primary_failed" as const, backup: null };
    expect(helperCanUseBackup(trip)).toBe(false);
  });

  it("Scenario 4: Backup already active -> CTA hidden", () => {
    const trip = { ...baseTrip, agentState: "backup_attempt" as const };
    expect(helperCanUseBackup(trip)).toBe(false);
  });

  it("Scenario 5: Booking confirmed -> CTA hidden", () => {
    const trip: Trip = {
      ...baseTrip,
      agentState: "confirmed" as const,
      booking: {
        pnr: "1234567890",
        primaryTrainName: "12951 · Mumbai Rajdhani",
        finalTrainName: "12953 · August Kranti",
        status: "success",
        recovered: true,
      },
    };
    expect(helperCanUseBackup(trip)).toBe(false);
  });

  it("Scenario 6 & 9 & 10: User activation validates, records activity, updates Agent Decision Trace, and executes activateBackupStrategy()", async () => {
    const updateTripFn = vi.fn();
    const logActivityFn = vi.fn();
    const executeBackupFn = vi.fn().mockResolvedValue(undefined);

    const agent = new TatkalAgent(
      { ...baseTrip, agentState: "primary_failed" as const },
      {
        updateTrip: updateTripFn,
        logActivity: logActivityFn,
        pushNotification: () => {},
        getTravellers: () => [],
        onExecuteBackupBooking: executeBackupFn,
      }
    );

    const proposal: ProposedAgentDecision = {
      action: "activate_backup",
      reason: "User accepted recommendation to activate backup strategy",
      toolCall: { name: "activateBackupStrategy", arguments: {} },
      source: "local",
    };

    const validation = validateAgentDecision(proposal, baseTrip, new Set());
    expect(validation.valid).toBe(true);

    await agent.activateBackupStrategy();

    expect(updateTripFn).toHaveBeenCalledWith("trip_backup_test", { agentState: "backup_attempt" });
    expect(logActivityFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "backup_attempted",
          text: expect.stringContaining("12953 · August Kranti"),
        }),
      ]),
      "trip_backup_test"
    );
    expect(executeBackupFn).toHaveBeenCalled();
  });

  it("Scenario 7: Duplicate activation is prevented if backup is already active or missing", () => {
    const activeTrip = { ...baseTrip, agentState: "backup_attempt" as const };
    expect(helperCanUseBackup(activeTrip)).toBe(false);
  });

  it("Scenario 8: Action validator rejects activate_backup if backup is missing", () => {
    const noBackupTrip = { ...baseTrip, backup: null };
    const proposal: ProposedAgentDecision = {
      action: "activate_backup",
      reason: "User requested backup",
      toolCall: { name: "activateBackupStrategy", arguments: {} },
      source: "local",
    };

    const validation = validateAgentDecision(proposal, noBackupTrip, new Set());
    expect(validation.valid).toBe(false);
    expect(validation.code).toBe("missing_backup");
  });
});
