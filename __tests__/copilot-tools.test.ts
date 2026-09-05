import { describe, it, expect } from "vitest";
import type { Trip } from "@/types";
import type { CopilotContext } from "@/lib/copilot";
import {
  COPILOT_TOOLS,
  answerWithTools,
  getBackupOption,
  getBookingStatus,
  getReadiness,
  getWalletBalance,
  permissionFor,
  requestBookingConfirmation,
  useBackupOption,
} from "@/lib/copilot";
import { DEFAULT_WALLET } from "@/lib/payments";
import { DEFAULT_IDENTITY } from "@/lib/identity";

const trip: Trip = {
  id: "trip_copilot_test",
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
  agentState: "window_open",
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

const ctx: CopilotContext = {
  lang: "en",
  trip,
  travellers: [],
  wallet: { ...DEFAULT_WALLET },
  identity: { ...DEFAULT_IDENTITY },
};

describe("Copilot tool registry (contract metadata)", () => {
  it("every tool declares name, permission and confirmation requirement", () => {
    for (const [key, meta] of Object.entries(COPILOT_TOOLS)) {
      expect(meta.name).toBe(key);
      expect(meta.purpose.length).toBeGreaterThan(0);
      expect(["informational", "preparation", "booking", "payment"]).toContain(meta.permission);
      expect(typeof meta.requiresConfirmation).toBe("boolean");
    }
  });

  it("informational tools never require confirmation; booking tools always do", () => {
    expect(permissionFor("get_readiness")).toBe("informational");
    expect(COPILOT_TOOLS.get_readiness.requiresConfirmation).toBe(false);
    expect(COPILOT_TOOLS.request_booking_confirmation.permission).toBe("booking");
    expect(COPILOT_TOOLS.request_booking_confirmation.requiresConfirmation).toBe(true);
  });
});

describe("Informational tools are grounded in the snapshot", () => {
  it("readiness reflects the actual trip", () => {
    const r = getReadiness(ctx);
    expect(r.ok).toBe(true);
    expect(r.data).toHaveProperty("totalCount");
  });

  it("wallet coverage is computed against the fare", () => {
    const r = getWalletBalance(ctx);
    expect(r.ok).toBe(true);
    // 8450 wallet vs 2 * 2360 = 4720 → covers
    expect((r.data as { covers: boolean }).covers).toBe(true);
    expect(r.speak).toMatch(/enough/i);
  });

  it("backup tool describes the prepared backup", () => {
    const r = getBackupOption(ctx);
    expect(r.ok).toBe(true);
    expect((r.data as { hasBackup: boolean }).hasBackup).toBe(true);
    expect(r.speak).toMatch(/Kota Junction/);
  });

  it("booking status reads 'nothing booked yet' before a booking", () => {
    const r = getBookingStatus(ctx);
    expect(r.data).toEqual({ status: "none" });
  });

  it("without a trip, tools fail gracefully — no invented data", () => {
    const empty: CopilotContext = { lang: "en" };
    const r = getReadiness(empty);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no_trip");
    expect(r.speak).not.toMatch(/\d{2}:\d{2}/); // no fabricated times
  });
});

describe("Question router maps spoken questions to tools (language-independent)", () => {
  it("routes a backup question", () => {
    const a = answerWithTools("What happens if this doesn't confirm?", ctx);
    expect(a?.tool).toBe("get_backup_option");
  });
  it("routes a wallet question", () => {
    expect(answerWithTools("Is my payment ready?", ctx)?.tool).toBe("get_wallet_balance");
  });
  it("routes a readiness question", () => {
    expect(answerWithTools("What am I missing?", ctx)?.tool).toBe("get_readiness");
  });
  it("returns null for an unrelated utterance (stays on the pick, no guessing)", () => {
    expect(answerWithTools("banana bread recipe", ctx)).toBeNull();
  });
});

describe("Action tools never bypass the action-validator", () => {
  it("booking is allowed and confirmation-gated when the window is open", () => {
    const plan = requestBookingConfirmation(ctx);
    expect(plan.ok).toBe(true);
    expect(plan.permission).toBe("booking");
    expect(plan.requiresConfirmation).toBe(true);
    expect(plan.route).toEqual({ kind: "mission_control", tripId: trip.id });
  });

  it("booking is refused once confirmed — via the validator, not a bypass", () => {
    const confirmed: CopilotContext = { ...ctx, trip: { ...trip, agentState: "confirmed" } };
    const plan = requestBookingConfirmation(confirmed);
    expect(plan.ok).toBe(false);
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("backup activation is refused when no backup was prepared", () => {
    const noBackup: CopilotContext = { ...ctx, trip: { ...trip, backup: null } };
    const plan = useBackupOption(noBackup);
    expect(plan.ok).toBe(false);
    expect(plan.error).toBe("missing_backup");
  });
});
