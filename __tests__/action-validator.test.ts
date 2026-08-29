import { describe, it, expect } from "vitest";
import { validateAgentDecision, type ProposedAgentDecision } from "@/lib/action-validator";
import type { Trip } from "@/types";

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
    travellerIds: ["t1"],
    boardingStationName: "Borivali",
    arrivalDisplay: "06:40 · tomorrow",
    fare: 2360,
    mode: "assisted",
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
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
    },
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Action Validator", () => {
  it("allows valid notify_user decision", () => {
    const trip = makeMockTrip();
    const sentKeys = new Set<string>();
    const decision: ProposedAgentDecision = {
      action: "notify_user",
      reason: "User inactive",
      toolCall: { name: "notifyUser", arguments: { channel: "whatsapp", title: "Window Open" } },
      source: "gpt",
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(true);
    expect(res.code).toBe("ok");
  });

  it("rejects duplicate notification", () => {
    const trip = makeMockTrip();
    const sentKeys = new Set<string>(["whatsapp:Window Open"]);
    const decision: ProposedAgentDecision = {
      action: "notify_user",
      reason: "User inactive",
      toolCall: { name: "notifyUser", arguments: { channel: "whatsapp", title: "Window Open" } },
      source: "gpt",
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("duplicate_notification");
  });

  it("rejects activate_backup when trip has no backup strategy", () => {
    const trip = makeMockTrip({ backup: null });
    const sentKeys = new Set<string>();
    const decision: ProposedAgentDecision = {
      action: "activate_backup",
      reason: "Primary failed",
      toolCall: { name: "activateBackupStrategy" },
      source: "gpt",
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("missing_backup");
  });

  it("rejects activate_backup when booking is already confirmed", () => {
    const trip = makeMockTrip({ agentState: "confirmed" });
    const sentKeys = new Set<string>();
    const decision: ProposedAgentDecision = {
      action: "activate_backup",
      reason: "Primary failed",
      toolCall: { name: "activateBackupStrategy" },
      source: "gpt",
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("already_completed");
  });

  it("rejects unregistered action", () => {
    const trip = makeMockTrip();
    const sentKeys = new Set<string>();
    const decision = {
      action: "hack_database" as unknown as ProposedAgentDecision["action"],
      reason: "Bad prompt",
      source: "gpt" as const,
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("disallowed_action");
  });

  it("rejects unregistered tool call name", () => {
    const trip = makeMockTrip();
    const sentKeys = new Set<string>();
    const decision: ProposedAgentDecision = {
      action: "notify_user",
      reason: "Alert",
      toolCall: { name: "deleteUserAccount" as unknown as ProposedAgentDecision["toolCall"] extends undefined ? never : NonNullable<ProposedAgentDecision["toolCall"]>["name"] },
      source: "gpt",
    };
    const res = validateAgentDecision(decision, trip, sentKeys);
    expect(res.valid).toBe(false);
    expect(res.code).toBe("disallowed_tool");
  });
});
