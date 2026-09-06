import { describe, it, expect } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { Trip } from "@/types";

function createMockTrip(mode: "assisted" | "auto" = "assisted", overrides?: Partial<Trip>): Trip {
  return {
    id: "trip_unified_test",
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

describe("Item 5A — Unified Copilot Brain Architecture", () => {
  it("Visual channel turn routes through executeCopilotTurn and records to canonical conversation", async () => {
    const trip = createMockTrip("assisted");
    const result = await executeCopilotTurn({
      channel: "visual",
      text: "Where am I going?",
      trip,
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("visual");
    expect(result.toolUsed).toBe("get_journey_context");
    expect(result.speakEnglish).toContain("Mumbai Central to New Delhi");
    expect(result.conversation.messages).toHaveLength(2);
    expect(result.conversation.messages[0].role).toBe("user");
    expect(result.conversation.messages[0].channel).toBe("visual");
    expect(result.conversation.messages[1].role).toBe("assistant");
    expect(result.conversation.messages[1].channel).toBe("visual");
  });

  it("Browser Voice channel turn routes through executeCopilotTurn with speech text", async () => {
    const trip = createMockTrip("assisted");
    const result = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Show me my backup",
      trip,
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("browser_voice");
    expect(result.toolUsed).toBe("get_backup_option");
    expect(result.speakEnglish).toContain("Split via Kota Junction");
    expect(result.conversation.channel).toBe("browser_voice");
  });

  it("Phone Calling channel turn routes through executeCopilotTurn with wallet context", async () => {
    const trip = createMockTrip("assisted");
    const wallet = {
      balance: 5000,
      history: [],
      currency: "INR" as const,
      lastUpdated: new Date().toISOString(),
    };

    const result = await executeCopilotTurn({
      channel: "phone",
      text: "Is my payment ready?",
      trip,
      wallet,
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("phone");
    expect(result.speakEnglish).toContain("5,000");
    expect(result.speakEnglish).toContain("enough for this journey");
    expect(result.conversation.messages[0].channel).toBe("phone");
  });

  it("WhatsApp channel turn routes through executeCopilotTurn and uses same tools", async () => {
    const trip = createMockTrip("assisted");
    const result = await executeCopilotTurn({
      channel: "whatsapp",
      text: "Am I ready?",
      trip,
    });

    expect(result.ok).toBe(true);
    expect(result.channel).toBe("whatsapp");
    expect(result.toolUsed).toBe("get_readiness");
    expect(result.conversation.messages[1].channel).toBe("whatsapp");
  });

  it("Enforces Action Validator: Assisted mode requires explicit confirmation for booking", async () => {
    const trip = createMockTrip("assisted");
    const result = await executeCopilotTurn({
      channel: "phone",
      text: "Book it now",
      trip,
    });

    expect(result.channel).toBe("phone");
    expect(result.toolUsed).toBe("request_booking_confirmation");
    expect(result.actionPlan?.requiresConfirmation).toBe(true);
    expect(result.speakEnglish).toContain("Ready to book");
    expect(result.validation?.valid).toBe(true);
  });

  it("Enforces Action Validator: Permissioned mode generates action plan without blocker", async () => {
    const trip = createMockTrip("auto");
    const result = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Book it now",
      trip,
    });

    expect(result.toolUsed).toBe("request_booking_confirmation");
    expect(result.actionPlan?.permission).toBe("booking");
    expect(result.validation?.valid).toBe(true);
  });

  it("Enforces Action Validator: Rejects backup action if trip has no backup strategy", async () => {
    const trip = createMockTrip("assisted", { backup: null });
    const result = await executeCopilotTurn({
      channel: "whatsapp",
      text: "Switch to backup",
      trip,
    });

    expect(result.toolUsed).toBe("use_backup_option");
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.code).toBe("missing_backup");
  });

  it("Multilingual support: preserves verbatim native Hindi script in originalText", async () => {
    const trip = createMockTrip("assisted");
    const hindiUtterance = "बैकअप दिखाओ";

    const result = await executeCopilotTurn({
      channel: "browser_voice",
      text: hindiUtterance,
      language: "hi",
      trip,
    });

    expect(result.originalText).toBe(hindiUtterance);
    expect(result.language).toBe("hi");
    expect(result.intent).toBe("backup");
    expect(result.toolUsed).toBe("get_backup_option");
    expect(result.conversation.messages[0].originalText).toBe(hindiUtterance);
  });

  it("Maintains multi-turn context across consecutive turns", async () => {
    const trip = createMockTrip("assisted");

    // Turn 1
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Where am I going?",
      trip,
    });
    expect(turn1.conversation.messages).toHaveLength(2);

    // Turn 2 passing the updated conversation
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Show my backup",
      trip,
      conversation: turn1.conversation,
    });
    expect(turn2.conversation.messages).toHaveLength(4);
    expect(turn2.conversation.messages[0].originalText).toBe("Where am I going?");
    expect(turn2.conversation.messages[2].originalText).toBe("Show my backup");
  });
});
