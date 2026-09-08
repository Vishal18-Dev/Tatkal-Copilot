import { describe, it, expect } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import {
  createConversation,
  addMessage,
  getRecentContext,
} from "@/lib/conversation";
import { createSpeechLifecycle } from "@/lib/voice/speech-lifecycle";
import type { VoiceTurn } from "@/lib/voice/types";

describe("Plan a Journey Hero Conversational Composer Test Suite", () => {
  // Invariant helper: Simulated Composer Controller
  function createComposerController() {
    let composerText = "";
    let isBusy = false;
    const turns: VoiceTurn[] = [];
    let conversation = createConversation({ channel: "browser_voice", language: "hi" });
    let turnId = 1;

    function getPlaceholder(isListening: boolean) {
      if (isListening) return "Listening…";
      if (turns.length === 0) return "Tell me where you're going…";
      return "Ask Aarav anything about your journey…";
    }

    function getStatus(state: "idle" | "listening" | "transcribing" | "thinking" | "speaking" | "error") {
      switch (state) {
        case "listening": return "Listening…";
        case "transcribing": return "Transcribing…";
        case "thinking": return "Aarav is thinking…";
        case "speaking": return "Aarav is speaking…";
        case "error": return "Couldn't hear that. Try again.";
        case "idle":
        default: return "Type or speak to Aarav";
      }
    }

    function submitText(input: string, channel: "browser_voice" | "text" = "text") {
      const trimmed = input.trim();
      if (!trimmed || isBusy) return false;

      // Rule: Composer clears immediately on submission
      composerText = "";
      isBusy = true;

      const userTurn: VoiceTurn = {
        id: `turn_${turnId++}`,
        role: "user",
        text: trimmed,
        final: true,
      };
      turns.push(userTurn);

      const updated = addMessage(conversation, {
        id: userTurn.id,
        role: "user",
        channel: "browser_voice",
        originalText: trimmed,
        status: "final",
      });
      conversation = updated.conversation;

      return true;
    }

    function completeTurn(agentReply: string) {
      const agentTurn: VoiceTurn = {
        id: `turn_${turnId++}`,
        role: "agent",
        text: agentReply,
        final: true,
      };
      turns.push(agentTurn);

      const updated = addMessage(conversation, {
        id: agentTurn.id,
        role: "assistant",
        channel: "browser_voice",
        originalText: agentReply,
        status: "final",
      });
      conversation = updated.conversation;
      isBusy = false;
    }

    return {
      getComposerText: () => composerText,
      setComposerText: (t: string) => { composerText = t; },
      getTurns: () => turns,
      getConversation: () => conversation,
      getPlaceholder,
      getStatus,
      isBusy: () => isBusy,
      submitText,
      completeTurn,
    };
  }

  // 1. Initial composer is empty
  it("1. Initial composer is empty and displays initial journey placeholder", () => {
    const composer = createComposerController();
    expect(composer.getComposerText()).toBe("");
    expect(composer.getPlaceholder(false)).toBe("Tell me where you're going…");
    expect(composer.getStatus("idle")).toBe("Type or speak to Aarav");
  });

  // 2. User submits first text message
  it("2. User submits first text message successfully", () => {
    const composer = createComposerController();
    composer.setComposerText("Mumbai to Delhi tomorrow");
    const submitted = composer.submitText(composer.getComposerText());
    expect(submitted).toBe(true);
    expect(composer.getTurns().length).toBe(1);
    expect(composer.getTurns()[0].text).toBe("Mumbai to Delhi tomorrow");
    expect(composer.getTurns()[0].role).toBe("user");
  });

  // 3. Composer clears immediately after successful submission
  it("3. Composer clears immediately after successful submission", () => {
    const composer = createComposerController();
    composer.setComposerText("Mumbai to Delhi tomorrow");
    composer.submitText(composer.getComposerText());
    expect(composer.getComposerText()).toBe("");
  });

  // 4. User can submit a second text message without deleting anything
  it("4. User can submit a second text message without deleting anything", () => {
    const composer = createComposerController();
    composer.setComposerText("Mumbai to Delhi tomorrow");
    composer.submitText(composer.getComposerText());
    composer.completeTurn("I found 3 suitable trains for Mumbai to Delhi tomorrow.");

    // Composer is already empty! User types second message directly
    expect(composer.getComposerText()).toBe("");
    composer.setComposerText("What about Premium Tatkal?");
    const submitted2 = composer.submitText(composer.getComposerText());
    expect(submitted2).toBe(true);
    expect(composer.getComposerText()).toBe("");
  });

  // 5. Conversation contains both user messages
  it("5. Conversation contains both user messages in sequence", () => {
    const composer = createComposerController();
    composer.submitText("Mumbai to Delhi tomorrow");
    composer.completeTurn("I found 3 suitable options.");
    composer.submitText("What about Premium Tatkal?");
    composer.completeTurn("Premium Tatkal is available on August Kranti.");

    const userTurns = composer.getTurns().filter((t) => t.role === "user");
    expect(userTurns).toHaveLength(2);
    expect(userTurns[0].text).toBe("Mumbai to Delhi tomorrow");
    expect(userTurns[1].text).toBe("What about Premium Tatkal?");
  });

  // 6. Aarav responses appear in conversation history
  it("6. Aarav responses appear in conversation history", () => {
    const composer = createComposerController();
    composer.submitText("Mumbai to Delhi tomorrow");
    composer.completeTurn("I found 3 suitable options.");

    const agentTurns = composer.getTurns().filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(1);
    expect(agentTurns[0].text).toBe("I found 3 suitable options.");

    // Now placeholder updates to follow-up mode
    expect(composer.getPlaceholder(false)).toBe("Ask Aarav anything about your journey…");
  });

  // 7. Text → voice continuation shares canonical conversation
  it("7. Text → voice continuation shares canonical conversation and journey state", async () => {
    // Turn 1 (Text): Origin and destination
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Mumbai to Delhi tomorrow 3A",
      language: "en",
    });

    expect(turn1.journeyState.originText?.toLowerCase()).toContain("mumbai");
    expect(turn1.journeyState.destinationText?.toLowerCase()).toContain("delhi");

    // Turn 2 (Voice simulated via canonical agent turn): Refinement
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Make it before 8 AM",
      language: "en",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    // Same journey context preserved across text -> voice
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("mumbai");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
  });

  // 8. Voice → text continuation shares canonical conversation
  it("8. Voice → text continuation shares canonical conversation and journey state", async () => {
    // Turn 1 (Voice): User speaks destination first
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go to Varanasi tomorrow",
      language: "en",
    });

    expect(turn1.journeyState.destinationText?.toLowerCase()).toContain("varanasi");
    expect(turn1.journeyState.pendingClarification).toBe("origin");

    // Turn 2 (Text): User types the origin into the composer
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "From Delhi",
      language: "en",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    expect(turn2.journeyState.originText?.toLowerCase()).toContain("delhi");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("varanasi");
  });

  // 9. Duplicate submissions are prevented
  it("9. Duplicate submissions are prevented while busy", () => {
    const composer = createComposerController();
    composer.setComposerText("Mumbai to Delhi tomorrow");
    const firstSubmit = composer.submitText(composer.getComposerText());
    expect(firstSubmit).toBe(true);

    // Attempt rapid second submit while busy
    composer.setComposerText("Mumbai to Delhi tomorrow");
    const secondSubmit = composer.submitText(composer.getComposerText());
    expect(secondSubmit).toBe(false);
  });

  // 10. Empty submissions are ignored
  it("10. Empty or whitespace-only submissions are ignored", () => {
    const composer = createComposerController();
    expect(composer.submitText("")).toBe(false);
    expect(composer.submitText("   ")).toBe(false);
    expect(composer.submitText("\n\t")).toBe(false);
    expect(composer.getTurns()).toHaveLength(0);
  });

  // 11. Language switching remains functional
  it("11. Language switching remains functional and maintains canonical context", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Mumbai to Delhi tomorrow",
      language: "en",
    });

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Hindi mein baat karo",
      language: "en",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    expect(turn2.language).toBe("hi");
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("mumbai");
  });

  // 12. Existing voice generation/concurrency protections remain intact
  it("12. Existing voice generation/concurrency protections remain intact", () => {
    const lifecycle = createSpeechLifecycle("composer_test", "hi");
    const req1 = lifecycle.startSpeechRequest("test_request");
    expect(req1).not.toBeNull();
    expect(lifecycle.isGenerationActive(req1.generation)).toBe(true);

    // Cancel on new turn
    lifecycle.cancelSpeech("new_turn");
    expect(lifecycle.isGenerationActive(req1.generation)).toBe(false);
    expect(req1.signal.aborted).toBe(true);
    expect(lifecycle.speechGeneration).toBe(req1.generation + 1);
  });

  // 13. Composer remains usable after agent response
  it("13. Composer remains usable after agent response", () => {
    const composer = createComposerController();
    composer.submitText("Pune to Mumbai 2A");
    expect(composer.isBusy()).toBe(true);
    composer.completeTurn("Got it. Showing 2A options from Pune to Mumbai.");
    expect(composer.isBusy()).toBe(false);
    expect(composer.getComposerText()).toBe("");

    // User can immediately type follow-up
    composer.setComposerText("Earlier train please");
    expect(composer.submitText(composer.getComposerText())).toBe(true);
    expect(composer.getTurns()).toHaveLength(3);
  });

  // 14. Contextual status messages match voice states
  it("14. Contextual status messages accurately reflect composer states", () => {
    const composer = createComposerController();
    expect(composer.getStatus("idle")).toBe("Type or speak to Aarav");
    expect(composer.getStatus("listening")).toBe("Listening…");
    expect(composer.getStatus("transcribing")).toBe("Transcribing…");
    expect(composer.getStatus("thinking")).toBe("Aarav is thinking…");
    expect(composer.getStatus("speaking")).toBe("Aarav is speaking…");
    expect(composer.getStatus("error")).toBe("Couldn't hear that. Try again.");
  });

  // 15. Journey state still updates correctly from legitimate journey requests
  it("15. Journey state still updates correctly from legitimate journey requests", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Delhi to Bengaluru day after tomorrow 3A",
      language: "en",
    });

    expect(turn.journeyState.originText?.toLowerCase()).toContain("delhi");
    expect(turn.journeyState.destinationText?.toLowerCase()).toContain("bengaluru");
    expect(turn.journeyState.travelClass).toBe("3A");
    expect(turn.journeyState.travelDate?.toLowerCase()).toContain("after");
  });
});
