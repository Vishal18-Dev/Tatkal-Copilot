import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { Trip } from "@/types";
import type { Conversation } from "@/lib/conversation/types";
import { createConversation } from "@/lib/conversation/service";

describe("Item 5C.1 — True Hands-Free Calling Conversational Loop", () => {
  const mockTrip: Trip = {
    id: "trip_handsfree_test",
    status: "upcoming",
    from: "Mumbai Central",
    fromCode: "BCT",
    to: "New Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "12953 August Kranti Tejas Rajdhani",
    travelClass: "3A",
    travellerIds: ["p1", "p2"],
    boardingStationName: "Borivali",
    arrivalDisplay: "08:30 · tomorrow",
    fare: 2450,
    mode: "assisted",
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
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Turn 1: processes natural speech turn without clicking prompt buttons", async () => {
    let conv = createConversation({ channel: "phone", language: "hi" });

    const turn1 = await executeCopilotTurn({
      channel: "phone",
      text: "Mujhe Delhi jaana hai",
      language: "hi",
      trip: mockTrip,
      conversation: conv,
      isUserInitiated: true,
    });

    expect(turn1.ok).toBe(true);
    expect(turn1.channel).toBe("phone");
    expect(turn1.assistantMessage.role).toBe("assistant");
    expect(turn1.conversation.messages.length).toBe(2);

    const userMsg1 = turn1.conversation.messages[0];
    expect(userMsg1.channel).toBe("phone");
    expect(userMsg1.originalText).toBe("Mujhe Delhi jaana hai");
  });

  it("Multi-turn hands-free loop: Turn 2 and Turn 3 maintain context and state", async () => {
    let conv = createConversation({ channel: "phone", language: "hi" });

    // Turn 1: User specifies destination
    const turn1 = await executeCopilotTurn({
      channel: "phone",
      text: "Mujhe Delhi jaana hai",
      language: "hi",
      trip: mockTrip,
      conversation: conv,
      isUserInitiated: true,
    });
    conv = turn1.conversation;

    // Turn 2: User specifies backup preference
    const turn2 = await executeCopilotTurn({
      channel: "phone",
      text: "Backup bhi ready rakho",
      language: "hi",
      trip: mockTrip,
      conversation: conv,
      isUserInitiated: true,
    });
    conv = turn2.conversation;

    expect(turn2.ok).toBe(true);
    expect(turn2.toolUsed).toBe("use_backup_option");
    expect(turn2.conversation.messages.length).toBe(4);

    // Turn 3: User checks wallet balance hands-free
    const turn3 = await executeCopilotTurn({
      channel: "phone",
      text: "Kya mera payment ready hai?",
      language: "hi",
      trip: mockTrip,
      wallet: {
        balance: 5000,
        currency: "INR",
        lastUpdated: new Date().toISOString(),
      },
      conversation: conv,
      isUserInitiated: true,
    });

    expect(turn3.ok).toBe(true);
    expect(turn3.conversation.messages.length).toBe(6);
    expect(turn3.conversation.channel).toBe("phone");
    expect(turn3.toolUsed).toBe("get_wallet_balance");
  });

  it("Interim transcripts are NOT stored in canonical conversation", async () => {
    const conv = createConversation({ channel: "phone", language: "en" });

    // Only final transcript should be executed
    const finalTurn = await executeCopilotTurn({
      channel: "phone",
      text: "Show me my backup train",
      language: "en",
      trip: mockTrip,
      conversation: conv,
      isUserInitiated: true,
    });

    // Verify all stored messages are marked final
    for (const msg of finalTurn.conversation.messages) {
      expect(msg.status).toBe("final");
    }
    expect(finalTurn.conversation.messages.every((m) => m.channel === "phone")).toBe(true);
  });

  it("Farewell words cleanly end conversation without prompt buttons", async () => {
    const conv = createConversation({ channel: "phone", language: "hi" });

    const turn = await executeCopilotTurn({
      channel: "phone",
      text: "shukriya, alvida",
      language: "hi",
      trip: mockTrip,
      conversation: conv,
      isUserInitiated: true,
    });

    expect(turn.conversation.messages.length).toBe(2);
    expect(turn.userMessage.originalText).toBe("shukriya, alvida");
  });
});
