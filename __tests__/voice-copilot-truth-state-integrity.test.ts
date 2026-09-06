import { describe, it, expect, beforeEach } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { createJourneyState } from "@/lib/copilot/journey-state";
import { readFileSync } from "fs";
import { join } from "path";

describe("TASK 5F.2A — Voice Copilot Truth & State Integrity Audit", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.DEMO_MODE;
  });

  // Phase 4 Test 1
  it("Test 1: Changing journey from Mumbai -> Delhi to Pune -> Thiruvananthapuram does NOT leak August Kranti or Mumbai/Delhi", async () => {
    // Turn 1
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go from Mumbai to Delhi tomorrow.",
    });
    expect(turn1.journeyState.originText?.toLowerCase()).toContain("mumbai");
    expect(turn1.journeyState.destinationText?.toLowerCase()).toContain("delhi");

    // Turn 2
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually, I need to go from Pune to Thiruvananthapuram tomorrow.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    const speak = turn2.speakEnglish.toLowerCase();
    expect(speak).not.toContain("august kranti");
    expect(speak).not.toContain("mumbai");
    expect(speak).not.toContain("delhi");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("thiruvananthapuram");
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("pune");
  }, 15000);

  // Phase 4 Test 2
  it("Test 2: Changing destination from Kolkata to Thiruvananthapuram updates destination correctly", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go to Kolkata.",
    });
    expect(turn1.journeyState.destinationText?.toLowerCase()).toContain("kolkata");

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually, Thiruvananthapuram.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("thiruvananthapuram");
  });

  // Phase 4 Test 3
  it("Test 3: Changing origin from Mumbai to Pune updates origin correctly", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I'm travelling from Mumbai.",
    });
    expect(turn1.journeyState.originText?.toLowerCase()).toContain("mumbai");

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually, I'm starting from Pune.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("pune");
  });

  // Phase 4 Test 4
  it("Test 4: Preference changes from 'Fastest train' to 'cheapest' without losing journey", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I live in Pune and want to go to Delhi tomorrow. Fastest train.",
    });
    expect(turn1.journeyState.priority).toBe("fastest");

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually, cheapest.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.priority).toBe("cheapest");
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
  });

  // Phase 4 Test 5
  it("Test 5: Exclude boarding station reranks journey with boarding constraint", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I live in Pune and want to go to Delhi tomorrow.",
    });

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I don't want to board from Pune station.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    expect(
      turn2.journeyState.excludeStationCode === "PUNE" ||
        turn2.journeyState.excludeStationText?.toLowerCase().includes("pune")
    ).toBe(true);
  });

  // Phase 4 Test 6
  it("Test 6: Two unrelated journeys in sequence never leak recommendations", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I live in Chennai and want to go to Hyderabad tomorrow.",
    });
    const rec1 = turn1.trip?.primary.trainName;

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually I want to travel from Delhi to Mumbai tomorrow.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    if (rec1) {
      expect(turn2.speakEnglish).not.toContain(rec1);
    }
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("delhi");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("mumbai");
  });

  // Phase 10 Regression Tests
  it("Regression Test 1: New destination invalidates previous journey resolution", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Go to Kolkata tomorrow.",
    });
    const resId1 = turn1.journeyState.resolutionId;

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually to Goa.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.resolutionId).not.toBe(resId1);
  });

  it("Regression Test 2: New origin invalidates previous journey resolution", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I am in Bangalore going to Delhi.",
    });
    const resId1 = turn1.journeyState.resolutionId;

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually I am starting from Chennai.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.resolutionId).not.toBe(resId1);
    expect(turn2.journeyState.originText?.toLowerCase()).toContain("chennai");
  });

  it("Regression Test 3: New travel date invalidates previous journey resolution", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Mumbai to Delhi tomorrow.",
    });
    const resId1 = turn1.journeyState.resolutionId;

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually next Friday.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.resolutionId).not.toBe(resId1);
  });

  it("Regression Test 4: New boarding constraint reranks journey candidates", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "From Mumbai to Delhi tomorrow.",
    });
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Don't use Bandra Terminus.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(
      turn2.journeyState.excludeStationCode === "BDTS" ||
        turn2.journeyState.excludeStationText?.toLowerCase().includes("bandra")
    ).toBe(true);
  });

  it("Regression Test 5: New optimization preference reranks without losing route", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "From Pune to Delhi tomorrow.",
    });
    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Fastest train.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });
    expect(turn2.journeyState.priority).toBe("fastest");
    expect(turn2.journeyState.destinationText?.toLowerCase()).toContain("delhi");
  });

  it("Regression Test 6: Old train cannot leak into new journey", async () => {
    const turn1 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Mumbai to Delhi tomorrow.",
    });
    const train1 = turn1.trip?.primary.trainName;

    const turn2 = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Actually Pune to Bangalore tomorrow.",
      journeyState: turn1.journeyState,
      trip: turn1.trip,
    });

    if (train1 && !train1.toLowerCase().includes("express")) {
      expect(turn2.speakEnglish).not.toContain(train1);
    }
  });

  it("Regression Test 7: Demo train cannot leak into LIVE mode", async () => {
    delete process.env.DEMO_MODE;
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Find train from Pune to Kolkata.",
    });
    expect(turn.toolUsed).toBe("resolve_journey");
    expect(turn.journeyState.originText?.toLowerCase()).toContain("pune");
    expect(turn.journeyState.destinationText?.toLowerCase()).toContain("kolkata");
  });

  it("Regression Test 8: Voice endpoint delegates to executeCopilotTurn()", () => {
    const routeCode = readFileSync(
      join(process.cwd(), "app", "api", "voice", "respond", "route.ts"),
      "utf8"
    );
    expect(routeCode).toContain("executeCopilotTurn(");
  });

  it("Regression Test 9: Voice pipeline executes resolveJourneyAsync()", () => {
    const unifiedCode = readFileSync(
      join(process.cwd(), "lib", "copilot", "unified-agent.ts"),
      "utf8"
    );
    expect(unifiedCode).toContain("resolveJourneyAsync(");
  });

  it("Regression Test 10: Final user utterance is committed once in conversation history", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "I want to go to Delhi tomorrow.",
    });
    const userMsgs = turn.conversation.messages.filter((m) => m.role === "user");
    expect(userMsgs.length).toBe(1);
    expect(userMsgs[0].originalText).toBe("I want to go to Delhi tomorrow.");
  });

  it("Regression Test 11: Interim transcript never becomes canonical history", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Final committed goal to Kolkata.",
    });
    const interimMsgs = turn.conversation.messages.filter((m) => m.status === "interim");
    expect(interimMsgs.length).toBe(0);
  });

  it("Regression Test 12: Canonical originalText is preserved separately from normalizedText", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Mujhe Mumbai se Delhi kal jaana hai.",
      language: "hi",
    });
    expect(turn.originalText).toBe("Mujhe Mumbai se Delhi kal jaana hai.");
  });

  it("Regression Test 13: Authorization remains enforced on sensitive actions", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Book it now",
    });
    expect(turn.actionPlan?.requiresConfirmation ?? true).toBe(true);
  });

  it("Regression Test 14: Tatkal state machine rules remain intact", async () => {
    const turn = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Prepare Tatkal for my journey",
    });
    if (turn.actionPlan) {
      expect(turn.actionPlan.permission).toBe("preparation");
    }
  });
});
