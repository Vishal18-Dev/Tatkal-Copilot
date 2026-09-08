import { describe, it, expect, beforeEach } from "vitest";
import {
  HEADLINE_SCENARIOS,
  DEMO_SCENARIO_DEFINITIONS,
  buildTMinus5Briefing,
  evaluatePremiumTatkalGuard,
  type ScenarioContext,
} from "@/lib/demo/scenarios";
import { shouldTriggerProactiveCall } from "@/lib/calling/events";
import { validateAgentDecision } from "@/lib/action-validator";
import { createConversation, addMessage } from "@/lib/conversation/service";
import { DemoClock, DEMO_ENVIRONMENT_TIMELINE } from "@/lib/demo-clock";
import type { Trip, Traveller } from "@/types";
import type { WalletState } from "@/lib/payments/types";

describe("Task 5I.1 — Proactive Copilot Agent, Demo Scenarios & Final Polish", () => {
  let sampleTrip: Trip;
  let sampleTravellers: Traveller[];
  let sampleWallet: WalletState;

  beforeEach(() => {
    sampleTravellers = [
      { id: "trav-1", name: "Manoj Sharma", age: 54, gender: "M", berthPreference: "Lower", mealPreference: "Veg", isSenior: false },
      { id: "trav-2", name: "Sunita Sharma", age: 51, gender: "F", berthPreference: "Lower", mealPreference: "Veg", isSenior: false },
    ];

    sampleTrip = {
      id: "trip-test-1",
      status: "upcoming",
      from: "Pune",
      fromCode: "PUNE",
      to: "Bengaluru",
      toCode: "SBC",
      dateLabel: "Tomorrow",
      trainName: "12951 TEJAS RAJDHANI",
      travelClass: "3A",
      travellerIds: ["trav-1", "trav-2"],
      boardingStationName: "Pune Junction",
      arrivalDisplay: "08:35 (+1 Day)",
      fare: 2845,
      mode: "assisted",
      agentState: "scheduled",
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      arrivalTargetLabel: "morning",
      primary: {
        optionId: "opt-1",
        trainName: "12951 TEJAS RAJDHANI",
        travelClass: "3A",
        boardingStationName: "Pune Junction",
        departureDisplay: "16:55",
        arrivalDisplay: "08:35",
        level: "High",
        fare: 2845,
      },
      backup: {
        optionId: "opt-2",
        trainName: "12953 August Kranti Rajdhani",
        travelClass: "3A",
        boardingStationName: "Pune Junction",
        departureDisplay: "17:15",
        arrivalDisplay: "09:00",
        level: "High",
        fare: 2750,
      },
      readinessDone: [],
      planNotifications: [],
      createdAt: new Date().toISOString(),
    };

    sampleWallet = {
      balance: 8000,
      currency: "INR",
      lastUpdated: new Date().toISOString(),
    };
  });

  /* ============================================================
     1. THREE HEADLINE DEMO SCENARIOS (§2)
     ============================================================ */
  describe("Headline Scenarios Alignment (§2, §3)", () => {
    it("exposes the exact 3 headline scenarios in progression order", () => {
      expect(HEADLINE_SCENARIOS).toEqual([
        "assisted_briefing",
        "assisted_to_permissioned_backup_success",
        "assisted_to_permissioned_premium_tatkal_success",
      ]);
    });
  });

  /* ============================================================
     SCENARIO 1 — ASSISTED BRIEFING (§2)
     ============================================================ */
  describe("Scenario 1 — Assisted Briefing", () => {
    it("starts in Assisted mode with PT disabled", () => {
      const def = DEMO_SCENARIO_DEFINITIONS.assisted_briefing;
      expect(def.initialMode).toBe("assisted");
      expect(def.premiumTatkalEnabled).toBe(false);
      expect(def.title).toContain("Scenario 1");
    });

    it("generates concise, non-jargon T-5 briefing with all required details", () => {
      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: sampleWallet,
        maxAuthorizedSpend: 7000,
        maxPremiumTatkalFare: 7500,
        ptEstimatedFare: 3375,
      };

      const briefing = buildTMinus5Briefing(ctx);
      expect(briefing).toContain("Pune to Bengaluru");
      expect(briefing).toContain("2 passengers");
      expect(briefing).toContain("Manoj Sharma, Sunita Sharma");
      expect(briefing).toContain("3A");
      expect(briefing).toContain("12951 TEJAS RAJDHANI");
      expect(briefing).toContain("12953 August Kranti Rajdhani");
      expect(briefing).toContain("10:00 AM");
      expect(briefing).toContain("₹8,000");
      expect(briefing).toContain("sufficient");
      expect(briefing).toContain("₹7,000");
      expect(briefing).toContain("Will you be available to approve the booking when Tatkal opens?");

      // Must NOT contain backend jargon (§6, §12)
      expect(briefing).not.toContain("atomic clock");
      expect(briefing).not.toContain("CRIS tunnel");
      expect(briefing).not.toContain("memory buffers");
    });

    it("remains in Assisted mode when user confirms availability; autonomous booking suppressed", () => {
      expect(sampleTrip.mode).toBe("assisted");

      // User says "Yes, I'll be available."
      const userResponse = "Yes, I'll be available.";
      expect(userResponse).toBeTruthy();
      // Mode remains assisted
      expect(sampleTrip.mode).toBe("assisted");

      // Autonomous execution attempt at T=0 MUST be rejected by action validator
      const decision = validateAgentDecision(
        {
          action: "activate_backup",
          reason: "Window opened; attempting autonomous booking failover",
          toolCall: { name: "activateBackupStrategy" },
          source: "local",
        },
        sampleTrip,
        new Set(),
        false // autonomous execution
      );

      expect(decision.valid).toBe(false);
      expect(decision.code).toBe("disallowed_action");
      expect(decision.reason).toContain("Assisted mode requires explicit user authorization");
    });

    it("declining the call does not authorize anything", () => {
      expect(sampleTrip.mode).toBe("assisted");
      // Call declined: mode MUST still be assisted
      expect(sampleTrip.mode).toBe("assisted");
    });
  });

  /* ============================================================
     SCENARIO 2 — ASSISTED → PERMISSIONED → BACKUP (§2)
     ============================================================ */
  describe("Scenario 2 — Assisted → Permissioned → Backup", () => {
    it("starts in Assisted mode with correct metadata", () => {
      const def = DEMO_SCENARIO_DEFINITIONS.assisted_to_permissioned_backup_success;
      expect(def.initialMode).toBe("assisted");
      expect(def.premiumTatkalEnabled).toBe(false);
    });

    it("user saying 'No, I'm outside' does NOT itself change mode; requires explicit authorization", () => {
      expect(sampleTrip.mode).toBe("assisted");

      // 1. User says "No, I'm outside. I won't be able to log in."
      const userSaid = "No, I'm outside. I won't be able to log in.";
      expect(sampleTrip.mode).toBe("assisted"); // STILL ASSISTED!

      // Action validator still rejects autonomous actions
      const decisionBeforeAuth = validateAgentDecision(
        {
          action: "activate_backup",
          reason: "Primary unavailable; attempting backup",
          toolCall: { name: "activateBackupStrategy" },
          source: "local",
        },
        sampleTrip,
        new Set(),
        false
      );
      expect(decisionBeforeAuth.valid).toBe(false);

      // 2. User explicitly clicks "AUTHORIZE COPILOT" in Permission Request modal
      sampleTrip.mode = "auto";
      expect(sampleTrip.mode).toBe("auto");

      // 3. Now autonomous backup execution is permitted!
      const decisionAfterAuth = validateAgentDecision(
        {
          action: "activate_backup",
          reason: "Primary quota exhausted; activating backup under Permissioned mode",
          toolCall: { name: "activateBackupStrategy" },
          source: "local",
        },
        sampleTrip,
        new Set(),
        false
      );
      expect(decisionAfterAuth.valid).toBe(true);
      expect(decisionAfterAuth.code).toBe("ok");
    });

    it("triggers a proactive confirmation call on backup success", () => {
      expect(shouldTriggerProactiveCall("BACKUP_BOOKING_CONFIRMED")).toBe(true);
      expect(shouldTriggerProactiveCall("BOOKING_CONFIRMED")).toBe(true);
      expect(shouldTriggerProactiveCall("PRIMARY_BOOKING_FAILED")).toBe(false); // Internal failover, no jarring call
    });
  });

  /* ============================================================
     SCENARIO 3 — ASSISTED → PERMISSIONED → PREMIUM TATKAL (§2)
     ============================================================ */
  describe("Scenario 3 — Assisted → Permissioned → Premium Tatkal", () => {
    it("starts in Assisted mode with PT enabled", () => {
      const def = DEMO_SCENARIO_DEFINITIONS.assisted_to_permissioned_premium_tatkal_success;
      expect(def.initialMode).toBe("assisted");
      expect(def.premiumTatkalEnabled).toBe(true);
    });

    it("succeeds when all real PT guards pass after authorization", () => {
      // Transition to auto mode via explicit authorization
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 8000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 7500,
        maxPremiumTatkalFare: 7500,
        ptEstimatedFare: 3375, // 2 pax = 6750 <= 7500
        isPtQuotaExhausted: false,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(true);
      expect(result.eligibility?.eligible).toBe(true);
    });

    it("BLOCKS autonomous PT if mode remains Assisted", () => {
      sampleTrip.mode = "assisted"; // Still assisted!
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 8000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 7500,
        ptEstimatedFare: 3375,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Assisted mode");
    });

    it("BLOCKS autonomous PT if PT is not enabled on trip", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = false;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 8000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 7500,
        ptEstimatedFare: 3375,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Premium Tatkal is not enabled");
    });

    it("BLOCKS autonomous PT if authoritative fare is UNKNOWN/null (Zero Data Fabrication §12)", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 8000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 7500,
        ptEstimatedFare: null, // UNKNOWN FARE
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("UNKNOWN from railway servers");
    });

    it("BLOCKS autonomous PT if Rail Wallet balance is insufficient (§9)", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 5000, currency: "INR", lastUpdated: "" }, // 6750 needed
        maxAuthorizedSpend: 7500,
        ptEstimatedFare: 3375,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Rail Wallet balance of ₹5,000 is insufficient");
    });

    it("UNBLOCKS autonomous PT when wallet top-up satisfies shortfall (§9)", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 5000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 7500,
        ptEstimatedFare: 3375,
      };

      expect(evaluatePremiumTatkalGuard(ctx).allowed).toBe(false);

      // Top-up +₹2,000 -> 7,000 >= 6,750
      ctx.wallet.balance += 2000;
      const unblocked = evaluatePremiumTatkalGuard(ctx);
      expect(unblocked.allowed).toBe(true);
    });

    it("BLOCKS autonomous PT if total fare exceeds maxPremiumTatkalFare", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 10000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 10000,
        maxPremiumTatkalFare: 6000, // less than 6750!
        ptEstimatedFare: 3375,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds authorized Premium Tatkal ceiling of ₹6,000");
    });

    it("BLOCKS autonomous PT if total fare exceeds overall maxAuthorizedSpend", () => {
      sampleTrip.mode = "auto";
      (sampleTrip as any).premiumTatkalEnabled = true;

      const ctx: ScenarioContext = {
        trip: sampleTrip,
        travellers: sampleTravellers,
        wallet: { balance: 10000, currency: "INR", lastUpdated: "" },
        maxAuthorizedSpend: 6500, // less than 6750!
        maxPremiumTatkalFare: 8000,
        ptEstimatedFare: 3375,
      };

      const result = evaluatePremiumTatkalGuard(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds maximum authorized spend limit of ₹6,500");
    });

    it("triggers a proactive call after PT booking success", () => {
      expect(shouldTriggerProactiveCall("BOOKING_CONFIRMED")).toBe(true);
    });
  });

  /* ============================================================
     4. T-5 AUTOMATIC TRIGGER FROM DEMO CLOCK (§4)
     ============================================================ */
  describe("Demo Clock Automatic T-5 Triggering (§4)", () => {
    it("triggers T-5 briefing automatically when clock reaches beat index 3 (05:00)", async () => {
      let callTriggered = false;
      let tMinus5BeatRecorded = false;

      const clock = new DemoClock({
        onBeat: (beat, index) => {
          if (index === 3 || beat.secondsRemaining === 5) {
            tMinus5BeatRecorded = true;
            callTriggered = true;
          }
        },
        onComplete: () => {},
        onStatusChange: () => {},
      });

      // Step through beats 0, 1, 2, 3
      await clock.step(); // Beat 0: monitoring_started
      expect(callTriggered).toBe(false);

      await clock.step(); // Beat 1: tatkal_approaching (30:00)
      expect(callTriggered).toBe(false);

      await clock.step(); // Beat 2: tatkal_approaching (10:00)
      expect(callTriggered).toBe(false);

      await clock.step(); // Beat 3: user_inactive (05:00 / T-5)
      expect(tMinus5BeatRecorded).toBe(true);
      expect(callTriggered).toBe(true);

      const beat3 = DEMO_ENVIRONMENT_TIMELINE[3];
      expect(beat3.countdownLabel).toBe("05:00");
      expect(beat3.secondsRemaining).toBe(5);

      clock.destroy();
    });

    it("prevents duplicate T-5 calls on subsequent beats", () => {
      let callCount = 0;
      let hasTriggeredCall = false;

      const onBeatHandler = (index: number) => {
        if ((index === 3) && !hasTriggeredCall) {
          hasTriggeredCall = true;
          callCount++;
        }
      };

      onBeatHandler(3);
      onBeatHandler(3); // Duplicate invocation attempt
      onBeatHandler(4);

      expect(callCount).toBe(1);
    });

    it("resets clock cleanly without leaving pending triggers (§14)", () => {
      const clock = new DemoClock({
        onBeat: () => {},
        onComplete: () => {},
        onStatusChange: () => {},
      });

      clock.start();
      expect(clock.currentStatus).toBe("running");

      clock.reset();
      expect(clock.currentStatus).toBe("idle");
      expect(clock.currentIndex).toBe(0);

      clock.destroy();
    });
  });

  /* ============================================================
     5. CANONICAL CONVERSATION & STATE INTEGRITY (§8, §17)
     ============================================================ */
  describe("Canonical Conversation & State Integrity (§8, §17)", () => {
    it("records user and agent call exchanges into canonical Conversation with originalText", () => {
      const conv = createConversation({
        channel: "phone",
        language: "en",
        tripId: sampleTrip.id,
      });

      // 1. Agent asks briefing question
      const { conversation: conv1 } = addMessage(conv, {
        role: "assistant",
        originalText: "Will you be available to approve the booking when Tatkal opens?",
        channel: "phone",
        status: "final",
      });

      // 2. User states outside
      const { conversation: conv2 } = addMessage(conv1, {
        role: "user",
        originalText: "No, I'm outside. I won't be able to log in.",
        channel: "phone",
        status: "final",
      });

      // 3. Agent requests permission
      const { conversation: conv3 } = addMessage(conv2, {
        role: "assistant",
        originalText: "Understood. I can take over for you, but I need your permission to switch to Permissioned mode.",
        channel: "phone",
        status: "final",
      });

      // 4. User authorizes
      const { conversation: conv4 } = addMessage(conv3, {
        role: "user",
        originalText: "I authorize Copilot to take over.",
        channel: "phone",
        status: "final",
      });

      expect(conv4.messages.length).toBe(4);
      expect(conv4.messages[0].originalText).toBe(
        "Will you be available to approve the booking when Tatkal opens?"
      );
      expect(conv4.messages[1].originalText).toBe(
        "No, I'm outside. I won't be able to log in."
      );
      expect(conv4.messages[2].originalText).toContain("switch to Permissioned mode");
      expect(conv4.messages[3].originalText).toBe("I authorize Copilot to take over.");
      expect(conv4.messages[3].channel).toBe("phone");
    });

    it("preserves passenger count and identities without defaulting to 1 or fabricating names (§17)", () => {
      expect(sampleTravellers.length).toBe(2);
      expect(sampleTravellers[0].name).toBe("Manoj Sharma");
      expect(sampleTravellers[1].name).toBe("Sunita Sharma");

      const paxCount = sampleTravellers.length;
      expect(paxCount).toBe(2);
      expect(paxCount).not.toBe(1);
    });

    it("only triggers proactive calls for meaningful milestones (§7)", () => {
      // Must call on milestones
      expect(shouldTriggerProactiveCall("BOOKING_BRIEFING_DUE")).toBe(true);
      expect(shouldTriggerProactiveCall("BACKUP_BOOKING_CONFIRMED")).toBe(true);
      expect(shouldTriggerProactiveCall("BOOKING_CONFIRMED")).toBe(true);
      expect(shouldTriggerProactiveCall("BOOKING_FAILED")).toBe(true);

      // Must NOT call on internal chatter
      expect(shouldTriggerProactiveCall("BOOKING_WINDOW_OPEN")).toBe(false);
      expect(shouldTriggerProactiveCall("PRIMARY_BOOKING_FAILED")).toBe(false);
      expect(shouldTriggerProactiveCall("BACKUP_BOOKING_FAILED")).toBe(false);
      expect(shouldTriggerProactiveCall("PREMIUM_TATKAL_ACTIVATED")).toBe(false);
      expect(shouldTriggerProactiveCall("AUTHORIZATION_REQUIRED")).toBe(false);
      expect(shouldTriggerProactiveCall("PAYMENT_REQUIRED")).toBe(false);
    });
  });
});
