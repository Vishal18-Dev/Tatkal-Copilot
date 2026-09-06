import { describe, it, expect } from "vitest";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { ConversationalJourneyState } from "@/lib/copilot/journey-state";

describe("Item 5F.2 — Conversational Journey Refinement", () => {
  it("executes full 5-turn refinement sequence maintaining state continuity", async () => {
    let currentState: ConversationalJourneyState | undefined = undefined;
    let trip = undefined;

    // Turn 1: Initial Intent
    const turn1 = await executeCopilotTurn({
      channel: "visual",
      text: "I live in Life Republic Pune and want to go to Kolkata tomorrow.",
      journeyState: currentState,
    });

    expect(turn1.ok).toBe(true);
    expect(turn1.journeyState.originText).toMatch(/Life Republic/i);
    expect(turn1.journeyState.destinationText).toMatch(/Kolkata/i);
    expect(turn1.journeyState.travelDate).toBe("tomorrow");
    expect(turn1.trip).toBeDefined();

    currentState = turn1.journeyState;
    trip = turn1.trip;

    // Turn 2: Boarding constraint update ("Don't want to go to Pune station")
    const turn2 = await executeCopilotTurn({
      channel: "visual",
      text: "I don't want to go to Pune station.",
      journeyState: currentState,
      trip,
    });

    expect(turn2.ok).toBe(true);
    expect(turn2.journeyState.originText).toMatch(/Life Republic/i);
    expect(turn2.journeyState.destinationText).toMatch(/Kolkata/i);
    expect(turn2.journeyState.travelDate).toBe("tomorrow");
    expect(turn2.journeyState.excludeStationCode).toBe("PUNE");
    expect(turn2.trip?.fromCode).not.toBe("PUNE");
    expect(turn2.speakEnglish).toMatch(/Excluded PUNE station|Pune/i);

    currentState = turn2.journeyState;
    trip = turn2.trip;

    // Turn 3: Change optimization objective to fastest
    const turn3 = await executeCopilotTurn({
      channel: "visual",
      text: "Actually, fastest option.",
      journeyState: currentState,
      trip,
    });

    expect(turn3.ok).toBe(true);
    expect(turn3.journeyState.originText).toMatch(/Life Republic/i);
    expect(turn3.journeyState.destinationText).toMatch(/Kolkata/i);
    expect(turn3.journeyState.excludeStationCode).toBe("PUNE");
    expect(turn3.journeyState.priority).toBe("fastest");
    expect(turn3.speakEnglish).toMatch(/fastest/i);

    currentState = turn3.journeyState;
    trip = turn3.trip;

    // Turn 4: Change optimization objective to cheaper
    const turn4 = await executeCopilotTurn({
      channel: "visual",
      text: "What about a cheaper option?",
      journeyState: currentState,
      trip,
    });

    expect(turn4.ok).toBe(true);
    expect(turn4.journeyState.originText).toMatch(/Life Republic/i);
    expect(turn4.journeyState.destinationText).toMatch(/Kolkata/i);
    expect(turn4.journeyState.excludeStationCode).toBe("PUNE");
    expect(turn4.journeyState.priority).toBe("cheapest");
    expect(turn4.speakEnglish).toMatch(/fare|cheapest/i);

    currentState = turn4.journeyState;
    trip = turn4.trip;

    // Turn 5: Transition into Tatkal preparation state
    const turn5 = await executeCopilotTurn({
      channel: "visual",
      text: "Okay, prepare the best one for Tatkal.",
      journeyState: currentState,
      trip,
    });

    expect(turn5.ok).toBe(true);
    expect(turn5.toolUsed).toBe("prepare_journey");
    expect(turn5.actionPlan).toBeDefined();
    expect(turn5.actionPlan?.permission).toBe("preparation");
    expect(turn5.actionPlan?.route?.kind).toBe("mission_control");
  });
});
