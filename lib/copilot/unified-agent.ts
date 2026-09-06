import type { Trip, Traveller } from "@/types";
import type { WalletState } from "@/lib/payments/types";
import type { IdentityReadiness } from "@/lib/identity/types";
import type { VoiceLang } from "@/lib/voice/languages";
import { bcp47For, fromBcp47, isVoiceLang } from "@/lib/voice/languages";
import { parseVoiceCommand } from "@/lib/voice/commands";
import type { SemanticCommandIntent } from "@/lib/voice/types";
import { answerWithTools, type RoutedAnswer } from "./router";
import {
  prepareJourney,
  requestBookingConfirmation,
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

  // ── Journey intent detection ───────────────────────────────────────
  // Trigger resolution when ANY new journey constraint was extracted,
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
    extracted.passengerCount
  );

  const hasTravelIntent =
    hasExtractedConstraint ||
    tripIsStale ||
    /\b(from\s+[a-z]+|to\s+[a-z]+|reach\s+[a-z]+|jaana hai|chalo)\b/i.test(originalText);

  // 3. Command-first Intent Routing
  const isBackupAction = /\b(switch to backup|use backup|activate backup|take backup|go with backup|backup lagao|backup use karo)\b/i.test(originalText);
  const isQueryingBackup = /\b(show|what|tell|describe|view|see|status|kaise|dikh|bata)\b/i.test(originalText) ||
    /बैकअप दिखाओ|പര്യായം കാണിക്കൂ|பரிந்துரை/i.test(originalText);

  const isBookingAction = /\b(book it|book now|start booking|book this|proceed to book|ticket book|book karo)\b/i.test(originalText);
  const isPreparationAction = /\b(prepare|prepare journey|prepare tatkal|prepare for tatkal|prepare best|setup tatkal|prepare it|prepare the best|get it ready|prepare the best one|prepare the best option)\b/i.test(originalText);

  if (isBackupAction || (recognizedIntent === "backup" && !isQueryingBackup)) {
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
    toolUsed = "request_booking_confirmation";
    actionPlan = requestBookingConfirmation(ctx);
    speakEnglish = actionPlan.speak;
    const tripForValidation = effectiveTrip ?? input.trip;
    if (tripForValidation) {
      validation = validateAgentDecision(
        { action: "open_booking_flow", reason: "User requested booking via Copilot", source: "local" },
        tripForValidation,
        new Set(),
        isUserInitiated
      );
    }
  } else if (recognizedIntent === "confirm") {
    const activeTrip = effectiveTrip ?? input.trip;
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
    } else if (activeTrip?.agentState === "window_open") {
      toolUsed = "request_booking_confirmation";
      actionPlan = requestBookingConfirmation(ctx);
      speakEnglish = actionPlan.speak;
      validation = validateAgentDecision(
        { action: "open_booking_flow", reason: "User confirmed booking via Copilot", source: "local" },
        activeTrip,
        new Set(),
        isUserInitiated
      );
    } else {
      toolUsed = "confirm_current_action";
      speakEnglish = activeTrip
        ? `Confirmed. I'm keeping watch over your journey on ${activeTrip.primary.trainName}.`
        : "Confirmed. Tell me where you'd like to travel.";
    }
  } else if (recognizedIntent === "no" || recognizedIntent === "cancel" || recognizedIntent === "stop") {
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
    if (hasTravelIntent) {
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
            backup: backup
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
              : undefined,
            readinessDone: [],
            planNotifications: [],
            createdAt: new Date().toISOString(),
          };

          // Update both the mutable input reference and the context so
          // subsequent tool calls in THIS turn see the fresh trip.
          input.trip = newTrip;
          ctx.trip = newTrip;
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
