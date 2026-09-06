import { describe, it, expect } from "vitest";
import {
  createConversation,
  addMessage,
  updateMessage,
  getRecentContext,
  recordToolMessage,
  fromVoiceTurn,
  toVoiceTurn,
  fromCopilotTurn,
  toCopilotTurn,
  fromCallLine,
  toCallLine,
  fromWhatsAppMessage,
  toWhatsAppMessage,
  type Conversation,
  type ConversationMessage,
  type ConversationChannel,
} from "@/lib/conversation";
import type { VoiceTurn } from "@/lib/voice/types";
import type { CopilotTurn } from "@/lib/copilot/use-copilot-ask";
import type { CallLine } from "@/lib/calling/conversation";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import { validateAgentDecision } from "@/lib/action-validator";
import type { Trip } from "@/types";

describe("Unified Copilot Conversation Model (Item 3)", () => {
  const dummyTrip: Trip = {
    id: "trip_canonical_test",
    status: "upcoming",
    from: "NDLS",
    fromCode: "NDLS",
    to: "CNB",
    toCode: "CNB",
    dateLabel: "10 Sep 2026",
    trainName: "Howrah Rajdhani",
    travelClass: "3A",
    travellerIds: ["t1"],
    boardingStationName: "New Delhi",
    arrivalDisplay: "21:35 · same day",
    fare: 1850,
    mode: "assisted",
    createdAt: new Date().toISOString(),
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    primary: {
      optionId: "train_12302",
      trainName: "Howrah Rajdhani",
      travelClass: "3A",
      boardingStationName: "New Delhi",
      departureDisplay: "16:50",
      arrivalDisplay: "21:35",
      level: "Very High",
      fare: 1850,
    },
    backup: {
      optionId: "train_12304",
      trainName: "Poorva Express",
      travelClass: "3A",
      boardingStationName: "New Delhi",
      departureDisplay: "17:40",
      arrivalDisplay: "23:10",
      level: "High",
      fare: 1450,
    },
    readinessDone: [],
    planNotifications: [],
  };

  // 1. Create conversation
  it("creates a canonical conversation with default metadata and channels", () => {
    const conv = createConversation({
      channel: "browser_voice",
      language: "ta",
      sessionId: "session_123",
      tripId: "trip_abc",
    });

    expect(conv.id).toMatch(/^conv_/);
    expect(conv.channel).toBe("browser_voice");
    expect(conv.language).toBe("ta");
    expect(conv.sessionId).toBe("session_123");
    expect(conv.tripId).toBe("trip_abc");
    expect(conv.messages).toEqual([]);
    expect(conv.createdAt).toBeDefined();
    expect(conv.updatedAt).toBeDefined();
  });

  // 2. Add user message
  it("adds a user message to the conversation", () => {
    const conv = createConversation({ channel: "browser_voice", language: "hi" });
    const { conversation, message } = addMessage(conv, {
      role: "user",
      channel: "browser_voice",
      originalText: "मुझे कल दिल्ली जाना है",
      language: "hi",
      status: "final",
    });

    expect(conversation.messages.length).toBe(1);
    expect(message.id).toMatch(/^msg_/);
    expect(message.role).toBe("user");
    expect(message.originalText).toBe("मुझे कल दिल्ली जाना है");
    expect(message.conversationId).toBe(conv.id);
  });

  // 3. Add assistant message
  it("adds an assistant message to the conversation with audio metadata", () => {
    const conv = createConversation({ channel: "browser_voice", language: "hi" });
    const { conversation, message } = addMessage(conv, {
      role: "assistant",
      channel: "browser_voice",
      originalText: "मैंने नई दिल्ली के लिए राजधानी एक्सप्रेस ढूंढ ली है।",
      language: "hi",
      status: "final",
      audio: {
        present: true,
        durationMs: 3200,
        codec: "audio/wav",
      },
    });

    expect(conversation.messages.length).toBe(1);
    expect(message.role).toBe("assistant");
    expect(message.audio?.present).toBe(true);
    expect(message.audio?.durationMs).toBe(3200);
  });

  // 4. Preserve original language
  it("faithfully preserves original language and detected language", () => {
    const conv = createConversation({ channel: "browser_voice", language: "kn" });
    const { message } = addMessage(conv, {
      role: "user",
      channel: "browser_voice",
      originalText: "ನನಗೆ ಬೆಂಗಳೂರಿಗೆ ರೈಲು ಬೇಕು",
      language: "kn",
      detectedLanguage: "kn-IN",
      confidence: 0.98,
      status: "final",
    });

    expect(message.language).toBe("kn");
    expect(message.detectedLanguage).toBe("kn-IN");
    expect(message.confidence).toBe(0.98);
  });

  // 5 & 6. Preserve original transcript & store normalized text separately
  it("preserves authoritative original transcript and stores normalized text separately", () => {
    const conv = createConversation({ channel: "browser_voice", language: "ta" });
    const { message } = addMessage(conv, {
      role: "user",
      channel: "browser_voice",
      originalText: "இதை confirm பண்ணுங்க",
      normalizedText: "confirm this booking",
      language: "ta",
      status: "final",
    });

    // Authoritative user utterance is in Tamil
    expect(message.originalText).toBe("இதை confirm பண்ணுங்க");
    // Internal reasoning representation is in English
    expect(message.normalizedText).toBe("confirm this booking");
    expect(message.originalText).not.toBe(message.normalizedText);
  });

  // 7. Store semantic command intent
  it("stores normalized semantic command intent", () => {
    const conv = createConversation({ channel: "browser_voice", language: "mr" });
    const { message } = addMessage(conv, {
      role: "user",
      channel: "browser_voice",
      originalText: "दुसरा पर्याय दाखवा",
      language: "mr",
      intent: "backup",
      status: "final",
    });

    expect(message.intent).toBe("backup");
  });

  // 8. Store channel
  it("supports all 4 canonical channels without breaking message shape", () => {
    const channels: ConversationChannel[] = ["visual", "browser_voice", "phone", "whatsapp"];
    for (const channel of channels) {
      const conv = createConversation({ channel });
      const { message } = addMessage(conv, {
        role: "user",
        channel,
        originalText: "Hello",
        status: "final",
      });
      expect(message.channel).toBe(channel);
      expect(conv.channel).toBe(channel);
    }
  });

  // 9. Store timestamps
  it("records ISO timestamps for creation and updates", () => {
    const conv = createConversation({ channel: "visual" });
    const { conversation, message } = addMessage(conv, {
      role: "user",
      channel: "visual",
      originalText: "Check wallet balance",
      status: "final",
    });

    expect(Date.parse(message.createdAt)).not.toBeNaN();
    expect(Date.parse(conversation.updatedAt)).not.toBeNaN();

    const updated = updateMessage(conversation, message.id, {
      normalizedText: "Check user wallet balance",
    });
    expect(updated.messages[0].normalizedText).toBe("Check user wallet balance");
    expect(updated.messages[0].updatedAt).toBeDefined();
  });

  // 10. Store tool/action metadata
  it("records grounded tool invocation and result metadata", () => {
    const conv = createConversation({ channel: "visual" });
    const { conversation, message } = recordToolMessage(
      conv,
      {
        toolName: "getJourneyContext",
        inputs: { tripId: "trip_123" },
        permissionLevel: "informational",
        isUserInitiated: false,
        requiresConfirmation: false,
        result: { from: "NDLS", to: "CNB" },
      },
      "Retrieved journey context for NDLS -> CNB."
    );

    expect(conversation.messages.length).toBe(1);
    expect(message.role).toBe("tool");
    expect(message.toolAction?.toolName).toBe("getJourneyContext");
    expect(message.toolAction?.permissionLevel).toBe("informational");
    expect(message.toolAction?.requiresConfirmation).toBe(false);
  });

  // 11. Retrieve recent context (bounded window)
  it("retrieves a bounded context window formatted for LLM/agent reasoning", () => {
    let conv = createConversation({ channel: "browser_voice", language: "hi" });

    // Add 15 turns
    for (let i = 1; i <= 15; i++) {
      const res = addMessage(conv, {
        role: i % 2 === 1 ? "user" : "assistant",
        channel: "browser_voice",
        originalText: `Original utterance ${i}`,
        normalizedText: `Normalized reasoning text ${i}`,
        language: "hi",
        status: "final",
      });
      conv = res.conversation;
    }

    expect(conv.messages.length).toBe(15);

    // Request default bounded context (max 10)
    const contextDefault = getRecentContext(conv);
    expect(contextDefault.turns.length).toBe(10);
    expect(contextDefault.totalMessagesCount).toBe(15);
    expect(contextDefault.turns[0].content).toBe("Normalized reasoning text 6");
    expect(contextDefault.turns[9].content).toBe("Normalized reasoning text 15");

    // Request with original_first preference
    const contextOriginal = getRecentContext(conv, {
      maxMessages: 3,
      reasoningPreference: "original_first",
    });
    expect(contextOriginal.turns.length).toBe(3);
    expect(contextOriginal.turns[0].content).toBe("Original utterance 13");
  });

  // 12. Adapters for legacy turn representations
  describe("Legacy Adapters (100% Backwards Compatibility)", () => {
    it("converts between legacy VoiceTurn and canonical ConversationMessage", () => {
      const voiceTurn: VoiceTurn = {
        id: "turn_123",
        role: "agent",
        text: "Your train is confirmed",
        final: true,
      };

      const msg = fromVoiceTurn(voiceTurn, { conversationId: "conv_v1", language: "en" });
      expect(msg.id).toBe("turn_123");
      expect(msg.role).toBe("assistant");
      expect(msg.originalText).toBe("Your train is confirmed");
      expect(msg.status).toBe("final");

      const backToTurn = toVoiceTurn(msg);
      expect(backToTurn.id).toBe(voiceTurn.id);
      expect(backToTurn.role).toBe(voiceTurn.role);
      expect(backToTurn.text).toBe(voiceTurn.text);
      expect(backToTurn.final).toBe(voiceTurn.final);
    });

    it("converts between visual CopilotTurn and canonical ConversationMessage", () => {
      const copilotTurn: CopilotTurn = {
        id: "ask_456",
        role: "user",
        text: "What is my backup option?",
      };

      const msg = fromCopilotTurn(copilotTurn);
      expect(msg.id).toBe("ask_456");
      expect(msg.role).toBe("user");
      expect(msg.channel).toBe("visual");

      const backToTurn = toCopilotTurn(msg);
      expect(backToTurn.id).toBe(copilotTurn.id);
      expect(backToTurn.role).toBe(copilotTurn.role);
      expect(backToTurn.text).toBe(copilotTurn.text);
    });

    it("converts between CallLine and canonical ConversationMessage", () => {
      const callLine: CallLine = {
        id: "step_open",
        text: "Tatkal window opens in 2 minutes.",
      };

      const msg = fromCallLine(callLine);
      expect(msg.id).toBe("step_open");
      expect(msg.role).toBe("assistant");
      expect(msg.channel).toBe("phone");

      const backToLine = toCallLine(msg);
      expect(backToLine.id).toBe(callLine.id);
      expect(backToLine.text).toBe(callLine.text);
    });

    it("converts between WhatsAppMessage and canonical ConversationMessage", () => {
      const waMsg: WhatsAppMessage = {
        id: "wa_789",
        role: "copilot",
        text: "Here are the top Tatkal trains.",
        time: "10:00 AM",
      };

      const msg = fromWhatsAppMessage(waMsg);
      expect(msg.id).toBe("wa_789");
      expect(msg.role).toBe("assistant");
      expect(msg.channel).toBe("whatsapp");

      const backToWa = toWhatsAppMessage(msg);
      expect(backToWa.id).toBe(waMsg.id);
      expect(backToWa.role).toBe("copilot");
      expect(backToWa.text).toBe(waMsg.text);
    });
  });

  // 13. Safety Boundary: Conversation does not authorize actions
  describe("Safety & Authorization Boundary", () => {
    it("never authorizes actions simply because a message exists in conversation", () => {
      const conv = createConversation({ channel: "browser_voice" });

      // User utterance with intent confirm and booking permission metadata
      const { conversation, message } = addMessage(conv, {
        role: "user",
        channel: "browser_voice",
        originalText: "Book this train now",
        intent: "confirm",
        status: "final",
        toolAction: {
          permissionLevel: "booking",
          requiresConfirmation: true,
          isUserInitiated: false, // NOT user-initiated
        },
      });

      expect(message.intent).toBe("confirm");
      expect(message.toolAction?.permissionLevel).toBe("booking");

      // The conversation model only stores the interaction.
      // Consequential action authorization must pass through the Action Validator!
      const uninitiatedDecision = {
        action: "open_booking_flow" as const,
        reason: "User said book",
        source: "local" as const,
      };

      const validation = validateAgentDecision(
        uninitiatedDecision,
        dummyTrip,
        new Set(),
        message.toolAction?.isUserInitiated ?? false // false
      );

      // Since isUserInitiated is false, the action validator strictly rejects it
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("Assisted mode requires explicit user initiation");

      // Only when explicitly authorized with user initiation does it pass
      const authorizedValidation = validateAgentDecision(
        uninitiatedDecision,
        dummyTrip,
        new Set(),
        true // isUserInitiated
      );
      expect(authorizedValidation.valid).toBe(true);
      expect(authorizedValidation.code).toBe("ok");
    });
  });
});
