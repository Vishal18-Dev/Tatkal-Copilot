import type { Trip, Traveller } from "@/types";
import type { WalletState } from "@/lib/payments/types";
import type { IdentityReadiness } from "@/lib/identity/types";
import type { VoiceLang } from "@/lib/voice/languages";
import { bcp47For, fromBcp47, isVoiceLang, getLanguageDialogue } from "@/lib/voice/languages";
import { parseVoiceCommand } from "@/lib/voice/commands";
import type { SemanticCommandIntent } from "@/lib/voice/types";
import { answerWithTools, type RoutedAnswer } from "./router";
import {
  prepareJourney,
  requestBookingConfirmation,
  openBookingFlow,
  useBackupOption,
  explainBookingAuthority,
  getJourneyContext,
  getRecommendations,
  getBackupOption,
  getReadiness,
  getWalletBalance,
  getIdentityStatus,
  getTatkalStatus,
  getBookingStatus,
  resolveJourney,
  resolveJourneyAsync,
} from "./tools";

import type { CopilotContext, ActionPlanResult, ToolResult } from "./types";
import { validateAgentDecision, type ProposedAgentDecision, type ValidationResult } from "@/lib/action-validator";
import { addMessage, createConversation } from "@/lib/conversation/service";
import type { Conversation, ConversationChannel, ConversationMessage } from "@/lib/conversation/types";
import type { JourneyResolutionResult } from "@/lib/geo/types";
import {
  extractJourneyConstraints,
  mergeJourneyConstraints,
  createJourneyState,
  journeyStateFromTrip,
  isTripStale,
  type ConversationalJourneyState,
} from "./journey-state";
import { extractStructuredIntent } from "./intent-extractor";

/* ============================================================
   Unified Copilot Brain — Single authoritative execution layer
   shared across Visual Website, Browser Voice, Phone Calling,
   and WhatsApp.

   ARCHITECTURAL PRINCIPLE:
   "The interface changes. The brain doesn't."

   No channel is permitted to invent or execute its own booking
   or recovery logic. Every consequential action must pass through:
     executeCopilotTurn() → validateAgentDecision() → execution.

   JOURNEY STATE PRINCIPLE:
   Every emitted recommendation is tagged with the resolutionId
   under which it was produced.  Any recommendation whose
   resolutionId differs from the current ConversationalJourneyState
   is STALE and is silently discarded before response generation.
   ============================================================ */

export interface CopilotTurnInput {
  /** The interaction channel originating this turn */
  channel: ConversationChannel; // "visual" | "browser_voice" | "phone" | "whatsapp"
  /** Spoken or typed user input */
  text: string;
  /** Active or detected language (defaults to "en") */
  language?: VoiceLang | string;
  /** Canonical trip snapshot */
  trip?: Trip;
  /** Registered travellers */
  travellers?: Traveller[];
  /** Rail wallet state */
  wallet?: WalletState;
  /** User Aadhaar/KYC identity readiness */
  identity?: IdentityReadiness;
  /** Existing conversation object to append to */
  conversation?: Conversation;
  /** Explicit user initiation flag (defaults to true for human interaction) */
  isUserInitiated?: boolean;
  /** Optional custom text translation function for native language output */
  translateFn?: (text: string, targetLangCode: string) => Promise<string>;
  /** Optional browser GPS coordinates */
  geolocation?: { latitude: number; longitude: number };
  /**
   * Conversational Journey State from the previous turn.
   * Callers thread this across turns to enable multi-turn constraint
   * accumulation.  When absent, state is bootstrapped from `trip` (demo
   * / saved journey) or created empty.
   */
  journeyState?: ConversationalJourneyState;
}

export interface CopilotTurnResult {
  ok: boolean;
  channel: ConversationChannel;
  originalText: string;
  normalizedText: string;
  language: VoiceLang;
  intent?: SemanticCommandIntent;
  toolUsed?: string;
  speakText: string;
  speakEnglish: string;
  actionPlan?: ActionPlanResult;
  toolResult?: ToolResult;
  validation?: ValidationResult;
  conversation: Conversation;
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
  trip?: Trip;
  /**
   * Updated Conversational Journey State.
   * Callers MUST pass this into the next call's `journeyState` input
   * to maintain multi-turn constraint continuity.
   */
  journeyState: ConversationalJourneyState;
}

/**
 * Execute a single turn through the Unified Copilot Brain.
 * This is the ONLY entry point for all channels to interact with Copilot reasoning.
 *
 * Journey-state contract:
 *   1. Extract constraints from the current utterance.
 *   2. Merge into the existing ConversationalJourneyState.
 *   3. If materialChange → discard stale trip, re-resolve journey.
 *   4. If input.trip origin/destination no longer matches the merged
 *      state → trip is STALE → reject it, re-resolve.
 *   5. Every emitted recommendation belongs to the current resolutionId.
 */
export async function executeCopilotTurn(input: CopilotTurnInput): Promise<CopilotTurnResult> {
  const channel = input.channel;
  const originalText = (input.text || "").trim();
  const rawLang = input.language || "en";
  const resolvedLang: VoiceLang = isVoiceLang(rawLang)
    ? rawLang
    : (fromBcp47(rawLang) ?? "en");
  const isUserInitiated = input.isUserInitiated ?? true;

  // Initialize or re-use canonical conversation
  let conv: Conversation =
    input.conversation ??
    createConversation({
      channel,
      language: resolvedLang,
      tripId: input.trip?.id,
    });

  // 1. Multilingual Semantic Command Parsing
  const command = parseVoiceCommand(originalText, resolvedLang);
  const recognizedIntent: SemanticCommandIntent = command.intent;

  // ── Language Change Control Operation (Invariant 8 & 10) ───────────
  if (command.intent === "language_change" && command.targetLanguage) {
    const targetLang = command.targetLanguage;
    const langPack = getLanguageDialogue(targetLang);
    const ackText = langPack.switchAck;
    conv = { ...conv, language: targetLang };

    const { conversation: convWithUser, message: userMsg } = addMessage(conv, {
      role: "user",
      channel,
      originalText,
      normalizedText: originalText,
      language: targetLang,
      intent: "language_change",
      status: "final",
    });

    const { conversation: updatedConv, message: assistantMsg } = addMessage(convWithUser, {
      role: "assistant",
      channel,
      originalText: ackText,
      language: targetLang,
      status: "final",
    });

    const currentJourneyState =
      input.journeyState ?? (input.trip ? journeyStateFromTrip(input.trip) : createJourneyState());

    return {
      ok: true,
      channel,
      originalText,
      normalizedText: originalText,
      language: targetLang,
      intent: "language_change",
      toolUsed: "language_switch",
      speakText: ackText,
      speakEnglish: ackText,
      conversation: updatedConv,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      journeyState: currentJourneyState,
      trip: input.trip,
    };
  }

  // ── Journey State: bootstrap or thread ────────────────────────────
  // Priority: explicit journeyState input > trip snapshot > empty
  let journeyState: ConversationalJourneyState =
    input.journeyState ??
    (input.trip ? journeyStateFromTrip(input.trip) : createJourneyState());

  // ── Extract constraints from this utterance (OpenAI + regex fallback) ──
  const extracted = await extractStructuredIntent(originalText, journeyState.pendingClarification);

  // ── Merge constraints into journey state ───────────────────────────
  const mergeResult = mergeJourneyConstraints(journeyState, extracted);
  journeyState = mergeResult.state;

  // ── Stale trip detection ───────────────────────────────────────────
  // If the input trip's origin/destination no longer matches the merged
  // journey state, the trip is stale.  It must be discarded so that the
  // response never references the old route.
  const tripIsStale = isTripStale(input.trip ?? null, journeyState);
  const effectiveTrip = tripIsStale ? undefined : input.trip;

  // 2. Build canonical Copilot context (using effective trip)
  const ctx: CopilotContext = {
    lang: resolvedLang === "hi" ? "hi" : "en",
    trip: effectiveTrip,
    travellers: input.travellers,
    wallet: input.wallet,
    identity: input.identity,
    geolocation: input.geolocation,
  };

  let toolUsed: string | undefined = undefined;
  let toolResult: ToolResult | undefined = undefined;
  let actionPlan: ActionPlanResult | undefined = undefined;
  let validation: ValidationResult | undefined = undefined;
  let speakEnglish = "";

  const wasPendingClarification = Boolean(journeyState.pendingClarification || input.journeyState?.pendingClarification);

  // ── Journey intent detection ───────────────────────────────────────
  // Trigger resolution when ANY new journey constraint was extracted,
  // when a clarification question is being answered,
  // when the trip is stale and needs re-resolution, or when the classic
  // travel-verb patterns appear.
  const hasExtractedConstraint = Boolean(
    extracted.originText ||
    extracted.destinationText ||
    extracted.residentOf ||
    extracted.boardingStationPreference ||
    extracted.excludeStationCode ||
    extracted.excludeStationText ||
    extracted.priority ||
    extracted.timeConstraint ||
    extracted.travelDate ||
    extracted.travelClass ||
    extracted.passengerCount ||
    extracted.allowedQuotas ||
    extracted.excludedQuotas
  );

  let hasTravelIntent =
    hasExtractedConstraint ||
    wasPendingClarification ||
    tripIsStale ||
    /\b(from\s+[a-z]+|to\s+[a-z]+|reach\s+[a-z]+|jaana hai|chalo)\b/i.test(originalText);

  // 3. Command-first Intent Routing
  const isBackupAction = /\b(switch to backup|use backup|activate backup|take backup|go with backup|backup lagao|backup use karo)\b/i.test(originalText);
  const isQueryingBackup = /\b(show|what|tell|describe|view|see|status|kaise|dikh|bata)\b/i.test(originalText) ||
    /बैकअप दिखाओ|पर्यायं കാണിക്കൂ|பரிந்துரை/i.test(originalText);

  const isPtSwitchAction =
    /\b(use premium tatkal|switch to premium tatkal|try premium tatkal|pt use karo|pt try karo)\b/i.test(originalText) ||
    /प्रीमियम तत्काल लगाओ|प्रीमियम तत्काल करो/i.test(originalText);

  const isPtQuery =
    /\b(premium tatkal|pt)\b/i.test(originalText) &&
    /\b(show|what|tell|can you|option|price|fare|kya hai|kitna|kaise|rule|cancellation)\b/i.test(originalText);

  const isAffirmativeProceed =
    /\b(?:proceed|go ahead|continue|chalo)\b/i.test(originalText) ||
    /^(?:yes|yeah|yep|yup|haan?|sure|ok|okay)[,\s]*(?:proceed|with\s+(?:the\s+)?booking|book|karo|chalo)?/i.test(originalText.trim());

  const isBookingAction =
    !wasPendingClarification && (
      isAffirmativeProceed ||
      /\b(book it|book now|start booking|book this|proceed to book|ticket book|book karo)\b/i.test(originalText) ||
      /\b(?:can\s+you\s+)?(?:proceed|go\s+ahead|start|continue)\s*(?:with\s+(?:the\s+)?)?(?:booking|reservation|ticket|tickets|tatkal)\b/i.test(originalText) ||
      /\b(?:proceed|book\s+this\s+train|book\s+the\s+train|book\s+ticket)\b/i.test(originalText) ||
      /\b(book\s+this\s+trip|book\s+the\s+trip|book\s+trip|book\s+this\s+journey|i\s+want\s+to\s+book|want\s+to\s+book|please\s+book|confirm\s+booking|confirm\s+the\s+booking|confirm\s+trip|book)\b/i.test(originalText.trim())
    );
  const isPreparationAction =
    /\b(prepare|prepare journey|prepare tatkal|prepare for tatkal|prepare best|setup tatkal|prepare it|prepare the best|get it ready|prepare the best one|prepare the best option)\b/i.test(originalText) ||
    /\b(?:can\s+you\s+)?(?:prepare|get\s+ready)\s*(?:the\s+)?(?:booking|journey|tatkal)\b/i.test(originalText);

  const pendingClarificationField = input.journeyState?.pendingClarification ?? journeyState.pendingClarification;
  const isAcknowledgement =
    /^(?:okay|ok|okie|k|sure|yes|yeah|yep|yup|hmm|hm|right|got it|fine|alright|all right|haan|theek hai|theek|ha|achha|acha|accha|done|cool)[\.!\s]*$/i.test(
      originalText.trim()
    );

  if (pendingClarificationField === "origin" && isAcknowledgement && !journeyState.originText) {
    toolUsed = "clarify_origin";
    speakEnglish = ctx.lang === "hi"
      ? "मुझे अभी भी आपका शुरूआती स्टेशन या शहर चाहिए। आप कहाँ से निकल रहे हैं?"
      : "I still need your starting location. Which city or area are you leaving from?";
    journeyState.pendingClarification = "origin";
  } else if (pendingClarificationField === "destination" && isAcknowledgement && !journeyState.destinationText) {
    toolUsed = "clarify_destination";
    speakEnglish = ctx.lang === "hi"
      ? "मुझे अभी भी आपका गंतव्य चाहिए। आप कहाँ जाना चाहते हैं?"
      : "I still need your destination. Which city or station would you like to travel to?";
    journeyState.pendingClarification = "destination";
  } else if (pendingClarificationField === "passengerCount" && isAcknowledgement && !journeyState.passengerCount) {
    toolUsed = "clarify_passenger_count";
    speakEnglish = ctx.lang === "hi"
      ? "कुल कितने यात्री यात्रा करेंगे? कृपया संख्या बताएं।"
      : "How many passengers will be travelling?";
    journeyState.pendingClarification = "passengerCount";
  } else if (isPtSwitchAction) {
    toolUsed = "switch_to_premium_tatkal";
    const { switchToPremiumTatkal } = await import("./tools");
    actionPlan = switchToPremiumTatkal(ctx, journeyState);
    speakEnglish = actionPlan.speak;
    const tripForValidation = effectiveTrip ?? input.trip;
    if (tripForValidation) {
      validation = validateAgentDecision(
        {
          action: "switch_to_premium_tatkal",
          reason: "User requested switch to Premium Tatkal via Copilot",
          source: "local",
          toolCall: {
            name: "switchToPremiumTatkal",
            arguments: {
              fare: tripForValidation.backup?.fare,
              maxFare: journeyState.maxFare,
              maxPremiumTatkalFare: journeyState.maxPremiumTatkalFare,
            },
          },
        },
        tripForValidation,
        new Set(),
        isUserInitiated
      );
    }
  } else if (isPtQuery) {
    toolUsed = "explain_strategy";
    const { explainStrategy } = await import("./tools");
    toolResult = explainStrategy(ctx, journeyState);
    speakEnglish = toolResult.speak;
  } else if (isBackupAction || (recognizedIntent === "backup" && !isQueryingBackup)) {
    toolUsed = "use_backup_option";
    actionPlan = useBackupOption(ctx);
    speakEnglish = actionPlan.speak;
    const tripForValidation = effectiveTrip ?? input.trip;
    if (tripForValidation) {
      validation = validateAgentDecision(
        { action: "activate_backup", reason: "User requested backup option via Copilot", source: "local" },
        tripForValidation,
        new Set(),
        isUserInitiated
      );
    }
  } else if (recognizedIntent === "backup" || (isQueryingBackup && /\bbackup\b/i.test(originalText))) {
    toolUsed = "get_backup_option";
    toolResult = getBackupOption(ctx);
    speakEnglish = toolResult.speak;
  } else if (isPreparationAction) {
    toolUsed = "prepare_journey";
    actionPlan = prepareJourney(ctx);
    speakEnglish = actionPlan.speak;
  } else if (isBookingAction) {
    let tripForBooking = effectiveTrip ?? (!tripIsStale ? input.trip : undefined);
    if (!tripForBooking && journeyState.originText && journeyState.destinationText) {
      toolResult = await resolveJourneyAsync(
        journeyState.originText,
        journeyState.destinationText,
        ctx,
        journeyState
      );
      if (toolResult.ok && toolResult.data && (toolResult.data as JourneyResolutionResult).primary) {
        const data = toolResult.data as JourneyResolutionResult;
        const primary = data.primary!;
        const backup = data.backup;

        const newTrip: Trip = {
          id: `trip_${Date.now()}`,
          status: "upcoming",
          from: data.origin.name,
          fromCode: primary.boardingStation.code,
          to: data.destination.name,
          toCode: primary.arrivalStation.code,
          dateLabel: "Tomorrow",
          trainName: primary.train.name,
          travelClass: primary.travelClass,
          travellerIds: ["p1"],
          boardingStationName: primary.boardingStation.name,
          arrivalDisplay: primary.train.arrival + " · tomorrow",
          fare: primary.fare,
          mode: "assisted",
          agentState: "scheduled",
          agentEnabled: true,
          tatkalOpensAtLabel: "10:00 AM",
          primary: {
            optionId: primary.optionId,
            trainName: primary.train.name,
            travelClass: primary.travelClass,
            boardingStationName: primary.boardingStation.name,
            departureDisplay: primary.train.departure,
            arrivalDisplay: primary.train.arrival + " · tomorrow",
            level: primary.tatkalConfirmProbability > 60 ? "High" : "Medium",
            fare: primary.fare,
          },
          backup: backup ? {
            optionId: backup.optionId,
            trainName: backup.train.name,
            travelClass: backup.travelClass,
            boardingStationName: backup.boardingStation.name,
            departureDisplay: backup.train.departure,
            arrivalDisplay: backup.train.arrival + " · tomorrow",
            level: backup.tatkalConfirmProbability > 60 ? "High" : "Medium",
            fare: backup.fare,
          } : undefined,
          readinessDone: [],
          planNotifications: [],
          createdAt: new Date().toISOString(),
        };
        tripForBooking = newTrip;
        input.trip = newTrip;
        ctx.trip = newTrip;
      }
    }
    if (!tripForBooking) {
      // No journey context — ask the user to specify where they want to travel.
      // Never silently default to a hardcoded corridor.
      toolUsed = "missing_journey_context";
      speakEnglish = journeyState.originText
        ? `Destination batao — kahan jaana hai ${journeyState.originText} se?`
        : "To book a Tatkal ticket, I need your journey first! Kahan se kahan jaana hai?";
      journeyState.pendingClarification = journeyState.originText ? "destination" : "origin";
    }

    if (!tripForBooking && input.trip) {
      tripForBooking = input.trip;
      ctx.trip = input.trip;
    }

    if (tripForBooking) {
      ctx.trip = tripForBooking;
      input.trip = tripForBooking;
    }

    if (isAffirmativeProceed) {
      toolUsed = "open_booking_flow";
      actionPlan = openBookingFlow(ctx);
      speakEnglish = actionPlan.speak;
      if (tripForBooking) {
        validation = validateAgentDecision(
          { action: "open_booking_flow", reason: "User confirmed booking via Copilot", source: "local" },
          tripForBooking,
          new Set(),
          isUserInitiated
        );
      }
    } else {
      toolUsed = "request_booking_confirmation";
      actionPlan = requestBookingConfirmation(ctx);
      speakEnglish = actionPlan.speak;
      if (tripForBooking) {
        validation = validateAgentDecision(
          { action: "open_booking_flow", reason: "User requested booking via Copilot", source: "local" },
          tripForBooking,
          new Set(),
          isUserInitiated
        );
      }
    }
  } else if (recognizedIntent === "confirm" || command.kind === "confirm" || command.intent === "yes") {
    let activeTrip = effectiveTrip ?? (!tripIsStale ? input.trip : undefined);
    if (!activeTrip && journeyState.originText && journeyState.destinationText) {
      toolResult = await resolveJourneyAsync(
        journeyState.originText,
        journeyState.destinationText,
        ctx,
        journeyState
      );
      if (toolResult.ok && toolResult.data && (toolResult.data as JourneyResolutionResult).primary) {
        const data = toolResult.data as JourneyResolutionResult;
        const primary = data.primary!;
        const backup = data.backup;

        const newTrip: Trip = {
          id: `trip_${Date.now()}`,
          status: "upcoming",
          from: data.origin.name,
          fromCode: primary.boardingStation.code,
          to: data.destination.name,
          toCode: primary.arrivalStation.code,
          dateLabel: "Tomorrow",
          trainName: primary.train.name,
          travelClass: primary.travelClass,
          travellerIds: ["p1"],
          boardingStationName: primary.boardingStation.name,
          arrivalDisplay: primary.train.arrival + " · tomorrow",
          fare: primary.fare,
          mode: "assisted",
          agentState: "scheduled",
          agentEnabled: true,
          tatkalOpensAtLabel: "10:00 AM",
          primary: {
            optionId: primary.optionId,
            trainName: primary.train.name,
            travelClass: primary.travelClass,
            boardingStationName: primary.boardingStation.name,
            departureDisplay: primary.train.departure,
            arrivalDisplay: primary.train.arrival + " · tomorrow",
            level: primary.tatkalConfirmProbability > 60 ? "High" : "Medium",
            fare: primary.fare,
          },
          backup: backup ? {
            optionId: backup.optionId,
            trainName: backup.train.name,
            travelClass: backup.travelClass,
            boardingStationName: backup.boardingStation.name,
            departureDisplay: backup.train.departure,
            arrivalDisplay: backup.train.arrival + " · tomorrow",
            level: backup.tatkalConfirmProbability > 60 ? "High" : "Medium",
            fare: backup.fare,
          } : undefined,
          readinessDone: [],
          planNotifications: [],
          createdAt: new Date().toISOString(),
        };
        activeTrip = newTrip;
        input.trip = newTrip;
        ctx.trip = newTrip;
      }
    }
    if (!activeTrip) {
      // No journey context — ask the user to specify their journey.
      // Never silently default to a hardcoded corridor.
      toolUsed = "missing_journey_context";
      speakEnglish = journeyState.originText
        ? `Destination batao — kahan jaana hai ${journeyState.originText} se?`
        : "Kahan se kahan jaana hai? Please tell me your origin and destination!";
      journeyState.pendingClarification = journeyState.originText ? "destination" : "origin";
    }

    if (!activeTrip && input.trip) {
      activeTrip = input.trip;
      ctx.trip = input.trip;
    }

    if (activeTrip) {
      ctx.trip = activeTrip;
      input.trip = activeTrip;
    }

    if (activeTrip?.agentState === "backup_recommended") {
      toolUsed = "use_backup_option";
      actionPlan = useBackupOption(ctx);
      speakEnglish = actionPlan.speak;
      validation = validateAgentDecision(
        { action: "activate_backup", reason: "User confirmed backup recovery via Copilot", source: "local" },
        activeTrip,
        new Set(),
        isUserInitiated
      );
    } else if (activeTrip) {
      const isInitialBookCommand = /\b(book it|book now|start booking|can you book|will you book|please book)\b/i.test(originalText);
      if (isInitialBookCommand) {
        toolUsed = "request_booking_confirmation";
        actionPlan = requestBookingConfirmation(ctx);
        speakEnglish = actionPlan.speak;
        validation = validateAgentDecision(
          { action: "open_booking_flow", reason: "User requested booking via Copilot", source: "local" },
          activeTrip,
          new Set(),
          isUserInitiated
        );
      } else {
        toolUsed = "open_booking_flow";
        actionPlan = openBookingFlow(ctx);
        speakEnglish = actionPlan.speak;
        validation = validateAgentDecision(
          { action: "open_booking_flow", reason: "User confirmed booking via Copilot", source: "local" },
          activeTrip,
          new Set(),
          isUserInitiated
        );
      }
    } else {
      toolUsed = "confirm_current_action";
      speakEnglish = "Confirmed. Tell me where you'd like to travel.";
    }

  } else if (!wasPendingClarification && (recognizedIntent === "no" || recognizedIntent === "cancel" || recognizedIntent === "stop" || command.kind === "reject" || command.kind === "cancel")) {
    toolUsed = "cancel_action";
    speakEnglish = "Understood. I have set that aside and will wait for your instructions.";
  } else if (/\b(retry|try again|phir se|dobara|ek baar aur)\b/i.test(originalText) || recognizedIntent === "repeat") {
    toolUsed = "retry_action";
    if (effectiveTrip?.backup && (effectiveTrip.agentState === "primary_failed" || effectiveTrip.agentState === "backup_recommended")) {
      actionPlan = useBackupOption(ctx);
      speakEnglish = actionPlan.speak;
      validation = validateAgentDecision(
        { action: "activate_backup", reason: "User retrying via backup", source: "local" },
        effectiveTrip,
        new Set(),
        isUserInitiated
      );
    } else {
      speakEnglish = "Let's try that again. Tell me how you would like to proceed.";
    }
  } else if (/\b(help|madad|what can you do|kya kar sakte ho)\b/i.test(originalText)) {
    toolUsed = "help";
    speakEnglish = "I can check your journey status, payment readiness, backup options, or Tatkal countdown. What would you like to know?";
  } else {
    const isAcknowledgement =
      /^(?:okay|ok|okie|k|sure|yes|yeah|yep|yup|hmm|hm|right|got it|fine|alright|all right|haan|theek hai|theek|ha|achha|acha|accha|done|cool)[\.!\s]*$/i.test(
        originalText.trim()
      );

    if (pendingClarificationField === "origin" && (!journeyState.originText || isAcknowledgement)) {
      toolUsed = "clarify_origin";
      speakEnglish = ctx.lang === "hi"
        ? "मुझे अभी भी आपका शुरूआती स्टेशन या शहर चाहिए। आप कहाँ से निकल रहे हैं?"
        : "I still need your starting location. Which city or area are you leaving from?";
      journeyState.pendingClarification = "origin";
    } else if (pendingClarificationField === "destination" && (!journeyState.destinationText || isAcknowledgement)) {
      toolUsed = "clarify_destination";
      speakEnglish = ctx.lang === "hi"
        ? "मुझे अभी भी आपका गंतव्य चाहिए। आप कहाँ जाना चाहते हैं?"
        : "I still need your destination. Which city or station would you like to travel to?";
      journeyState.pendingClarification = "destination";
    } else if (hasTravelIntent) {
      toolUsed = "resolve_journey";

      // ── MERGE-FIRST RESOLUTION ──────────────────────────────────────
      // Use the MERGED journey state's origin and destination — never
      // just the current utterance alone.  This ensures:
      //   - corrections propagate ("Actually Delhi" → new destination)
      //   - unchanged constraints survive ("I'm in Pune" → origin stays)
      //   - stale trips are replaced with fresh candidates
      //
      // ctx.trip is already set to effectiveTrip (null if stale), so
      // resolveJourney's fallback to ctx.trip?.from will correctly find
      // nothing rather than recycling the old route.
      toolResult = await resolveJourneyAsync(
        journeyState.originText,
        journeyState.destinationText,
        ctx,
        journeyState
      );
      speakEnglish = toolResult.speak;
      if (toolResult.data && (toolResult.data as any).pendingClarification) {
        journeyState.pendingClarification = (toolResult.data as any).pendingClarification;
      }

      // If a journey was successfully resolved and ranked, build a fresh
      // trip snapshot stamped with the current resolutionId.
      if (toolResult.ok && toolResult.data) {
        const data = toolResult.data as JourneyResolutionResult;
        if (data.primary) {
          const primary = data.primary;
          const backup = data.backup;

          const { evaluateBookingStrategies } = await import("@/lib/booking/strategy-engine");
          const strategyResult = evaluateBookingStrategies({
            rankedJourneys: data.rankedOptions,
            constraints: {
              maxFare: journeyState.maxFare,
              maxPremiumTatkalFare: journeyState.maxPremiumTatkalFare,
              preferredClass: journeyState.travelClass,
              preferredBoardingStation: journeyState.boardingStationPreference,
              confirmationPriority: journeyState.confirmationPriority,
              priceSensitivity: journeyState.priceSensitivity,
              arrivalPriority: journeyState.arrivalPriority,
              allowedQuotas: journeyState.allowedQuotas,
              excludedQuotas: journeyState.excludedQuotas,
              allowAutomaticFallback: journeyState.allowAutomaticFallback,
            },
            authorization: {
              mode: effectiveTrip?.mode === "auto" ? "permissioned" : "assisted",
              authorizedQuotas: journeyState.excludedQuotas?.includes("PT") ? ["TQ", "GN"] : ["TQ", "PT", "GN"],
              maxFare: journeyState.maxFare,
              maxPremiumTatkalFare: journeyState.maxPremiumTatkalFare,
              allowAutomaticFallback: Boolean(journeyState.allowAutomaticFallback),
              requireConfirmationForPremiumTatkal: effectiveTrip?.mode !== "auto",
            },
            isDemoMode: true,
          });

          const chosenBackup = strategyResult.backup;

          // Always create a new trip ID when the journey changes materially
          // so callers cannot accidentally reuse a stale trip by ID.
          const tripId =
            mergeResult.materialChange || tripIsStale
              ? `trip_${Date.now()}`
              : (effectiveTrip?.id ?? `trip_${Date.now()}`);

          const newTrip: Trip = {
            id: tripId,
            status: "upcoming",
            from: data.origin.name,
            fromCode: primary.boardingStation.code,
            to: data.destination.name,
            toCode: primary.arrivalStation.code,
            dateLabel: "Tomorrow",
            trainName: primary.train.name,
            travelClass: primary.travelClass,
            travellerIds: effectiveTrip?.travellerIds || ["p1"],
            boardingStationName: primary.boardingStation.name,
            arrivalDisplay: primary.train.arrival + " · tomorrow",
            fare: primary.fare,
            mode: effectiveTrip?.mode || "assisted",
            agentState: "scheduled",
            agentEnabled: true,
            tatkalOpensAtLabel: "10:00 AM",
            primary: {
              optionId: primary.optionId,
              trainName: primary.train.name,
              travelClass: primary.travelClass,
              boardingStationName: primary.boardingStation.name,
              departureDisplay: primary.train.departure,
              arrivalDisplay: primary.train.arrival + " · tomorrow",
              level: primary.tatkalConfirmProbability > 60 ? "High" : "Medium",
              fare: primary.fare,
            },
            backup: chosenBackup
              ? {
                  optionId: chosenBackup.id,
                  trainName: chosenBackup.trainName,
                  travelClass: (chosenBackup.travelClass as any) || primary.travelClass,
                  boardingStationName: chosenBackup.boardingStation.name,
                  departureDisplay: chosenBackup.departure,
                  arrivalDisplay: chosenBackup.arrival + " · tomorrow",
                  level: "High",
                  fare: chosenBackup.fare.amount ?? (backup ? backup.fare : primary.fare),
                }
              : (backup
                  ? {
                      optionId: backup.optionId,
                      trainName: backup.train.name,
                      travelClass: backup.travelClass,
                      boardingStationName: backup.boardingStation.name,
                      departureDisplay: backup.train.departure,
                      arrivalDisplay: backup.train.arrival + " · tomorrow",
                      level: backup.tatkalConfirmProbability > 60 ? "High" : "Medium",
                      fare: backup.fare,
                    }
                  : undefined),
            readinessDone: [],
            planNotifications: [],
            createdAt: new Date().toISOString(),
          };

          (newTrip as any).userConstraints = {
            maxFare: journeyState.maxFare,
            maxPremiumTatkalFare: journeyState.maxPremiumTatkalFare,
            confirmationPriority: journeyState.confirmationPriority,
            priceSensitivity: journeyState.priceSensitivity,
            arrivalPriority: journeyState.arrivalPriority,
            allowedQuotas: journeyState.allowedQuotas,
            excludedQuotas: journeyState.excludedQuotas,
            allowAutomaticFallback: journeyState.allowAutomaticFallback,
          };

          (newTrip as any).strategyAuthorization = {
            mode: effectiveTrip?.mode || "assisted",
            authorizedQuotas: journeyState.excludedQuotas?.includes("PT") ? ["TQ", "GN"] : ["TQ", "PT", "GN"],
            maxFare: journeyState.maxFare,
            maxPremiumTatkalFare: journeyState.maxPremiumTatkalFare,
            allowAutomaticFallback: Boolean(journeyState.allowAutomaticFallback),
            requireConfirmationForPremiumTatkal: (effectiveTrip?.mode || "assisted") === "assisted",
          };

          // If strategy engine has specific constraints rationale, add it to speak output
          if (
            journeyState.maxFare ||
            journeyState.maxPremiumTatkalFare ||
            journeyState.allowedQuotas ||
            journeyState.excludedQuotas ||
            journeyState.confirmationPriority ||
            journeyState.priceSensitivity
          ) {
            if (strategyResult.explanation) {
              speakEnglish += ` ${strategyResult.explanation}`;
            }
          }

          // Update both the mutable input reference and the context so
          // subsequent tool calls in THIS turn see the fresh trip.
          input.trip = newTrip;
          ctx.trip = newTrip;

          // If all details are in place (no pending clarification)
          // AND the user asked to proceed/book (or confirmed):
          const userWantsBooking =
            /\b(proceed|book|open|start|confirm|chalo|karo)\b/i.test(originalText) ||
            recognizedIntent === "yes";

          // ── Proactive clarification for missing key booking details ──────────
          // After resolving origin+destination, ask for passengers / class /
          // Premium Tatkal preference if they haven't been provided yet.
          // Only ask when the user hasn't already said "proceed".
          if (!journeyState.pendingClarification && !userWantsBooking) {
            if (!journeyState.passengerCount) {
              speakEnglish += " How many passengers will be travelling?";
              journeyState.pendingClarification = "passengerCount";
            } else if (!journeyState.travelClass) {
              speakEnglish += " Which class — 3A (AC 3 Tier), 2A (AC 2 Tier), or SL (Sleeper)?";
              journeyState.pendingClarification = "travelClass";
            } else if (!journeyState.allowedQuotas && !journeyState.excludedQuotas) {
              speakEnglish += " Would you like to enable Premium Tatkal (guaranteed availability, slightly higher fare)?";
              journeyState.pendingClarification = "quotaPreference";
            }
          }


          if (!journeyState.pendingClarification && userWantsBooking && wasPendingClarification) {
            toolUsed = "request_booking_confirmation";
            actionPlan = requestBookingConfirmation(ctx);
            speakEnglish = actionPlan.speak;
            validation = validateAgentDecision(
              { action: "open_booking_flow", reason: "User requested booking via Copilot", source: "local" },
              newTrip,
              new Set(),
              isUserInitiated
            );
          }
        }
      }
    } else {
      // 4. Informational Query Routing via answerWithTools
      const routed: RoutedAnswer | null = answerWithTools(originalText, ctx);
      if (routed) {
        toolUsed = routed.tool;
        toolResult = routed.result;
        speakEnglish = routed.result.speak;
      } else {
        // General conversational fallback
        if (effectiveTrip) {
          const journey = getJourneyContext(ctx);
          toolUsed = "get_journey_context";
          toolResult = journey;
          speakEnglish = journey.speak;
        } else {
          toolUsed = "general_assistance";
          speakEnglish = "I don't have an active journey yet. Where would you like to travel?";
        }
      }
    }
  }

  // 5. Native Multilingual Response Translation
  let speakText = speakEnglish;
  if (resolvedLang !== "en" && speakEnglish) {
    if (input.translateFn) {
      try {
        speakText = await input.translateFn(speakEnglish, bcp47For(resolvedLang));
      } catch {
        speakText = speakEnglish;
      }
    } else if (typeof window === "undefined" && process.env.SARVAM_API_KEY) {
      try {
        const { translateText } = await import("@/lib/voice/sarvam");
        speakText = await translateText(speakEnglish, { targetLanguageCode: bcp47For(resolvedLang) });
      } catch {
        speakText = speakEnglish;
      }
    }
  }

  // 6. Record to Canonical Conversation
  // (a) User message
  const userResult = addMessage(conv, {
    role: "user",
    channel,
    originalText,
    normalizedText: originalText,
    language: resolvedLang,
    intent: recognizedIntent !== "unknown" ? recognizedIntent : undefined,
    status: "final",
  });
  conv = userResult.conversation;
  const userMessage = userResult.message;

  // (b) Assistant message with tool & validation audit metadata
  const assistantResult = addMessage(conv, {
    role: "assistant",
    channel,
    originalText: speakText,
    normalizedText: speakEnglish,
    language: resolvedLang,
    status: "final",
    toolAction: toolUsed
      ? {
          toolName: toolUsed,
          permissionLevel: actionPlan?.permission ?? "informational",
          isUserInitiated,
          requiresConfirmation: actionPlan?.requiresConfirmation ?? false,
          validationResult: validation
            ? {
                allowed: validation.valid,
                reason: validation.reason,
                actionType: validation.code,
              }
            : undefined,
        }
      : undefined,
  });
  conv = assistantResult.conversation;
  const assistantMessage = assistantResult.message;

  return {
    ok: actionPlan ? actionPlan.ok : toolResult ? toolResult.ok : true,
    channel,
    originalText,
    normalizedText: originalText,
    language: resolvedLang,
    intent: recognizedIntent,
    toolUsed,
    speakText,
    speakEnglish,
    actionPlan,
    toolResult,
    validation,
    conversation: conv,
    userMessage,
    assistantMessage,
    trip: input.trip,
    journeyState,
  };
}
