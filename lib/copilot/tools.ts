import type { Trip } from "@/types";
import { calculateReadiness } from "@/lib/readiness";
import { validateAgentDecision } from "@/lib/action-validator";
import { formatFare } from "@/lib/utils";
import { resolveLocation, resolveLocationFromCoordinates } from "@/lib/geo/location-resolver";
import { resolveAndRankJourney, resolveAndRankJourneyAsync } from "@/lib/geo/journey-ranker";
import type {
  ActionPlanResult,
  CopilotContext,
  CopilotToolMeta,
  PermissionLevel,
  ToolResult,
} from "./types";

/* ============================================================
   The tool registry. Every tool is a pure function of the
   CopilotContext snapshot. Informational tools return grounded
   English one-liners (+ structured data); action tools return a
   VALIDATED PLAN and never mutate anything themselves.

   Grounding rule: a tool only ever states what the snapshot
   actually contains. If the data isn't there, it says so plainly
   rather than inventing a plausible answer (spec §12/§14).
   ============================================================ */

const NO_TRIP = "I don't have an active journey yet. Tell me where you'd like to go.";

function needTrip(ctx: CopilotContext): Trip | null {
  return ctx.trip ?? null;
}

/* ---------------- Informational tools ---------------- */

export function getJourneyContext(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  const pax = trip.travellerIds.length;
  const paxWord = pax === 1 ? "1 traveller" : `${pax} travellers`;
  return {
    ok: true,
    speak: `Your journey is ${trip.from} to ${trip.to} on ${trip.dateLabel}, for ${paxWord}.`,
    data: {
      from: trip.from,
      to: trip.to,
      date: trip.dateLabel,
      travellers: pax,
      mode: trip.mode,
      agentState: trip.agentState,
    },
  };
}

export function getRecommendations(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  const p = trip.primary;
  return {
    ok: true,
    speak: `I recommend ${p.trainName} in ${p.travelClass}, boarding at ${p.boardingStationName}. Confidence of confirming is ${p.level}.`,
    data: {
      trainName: p.trainName,
      travelClass: p.travelClass,
      boarding: p.boardingStationName,
      level: p.level,
      fare: p.fare,
    },
  };
}

export function getBackupOption(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  if (!trip.backup) {
    return {
      ok: true,
      speak: `There's no separate backup for this journey — ${trip.primary.trainName} is a strong single option.`,
      data: { hasBackup: false },
    };
  }
  const b = trip.backup;
  // Don't say "via X" when the train name already spells the route out.
  const via = b.via && !b.trainName.toLowerCase().includes(b.via.toLowerCase()) ? ` via ${b.via}` : "";
  return {
    ok: true,
    speak: `Your backup is ${b.trainName}${via}, held ready in case the primary doesn't confirm. Confidence ${b.level}.`,
    data: { hasBackup: true, trainName: b.trainName, via: b.via ?? null, level: b.level, fare: b.fare },
  };
}

export function getReadiness(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  const r = calculateReadiness(trip);
  const missing = r.checks.filter((c) => c.status !== "ready").map((c) => c.label);
  const speak = r.isReady
    ? `Everything's ready — all ${r.totalCount} checks are complete. You're prepared for the window.`
    : `${r.readyCount} of ${r.totalCount} checks are ready. Still to do: ${missing.join(", ")}.`;
  return { ok: true, speak, data: { readyCount: r.readyCount, totalCount: r.totalCount, isReady: r.isReady, missing } };
}

export function getWalletBalance(ctx: CopilotContext): ToolResult {
  const w = ctx.wallet;
  if (!w) return { ok: false, speak: "I can't see your Rail Wallet right now.", error: "no_wallet" };
  const trip = ctx.trip;
  const fare = trip ? trip.fare * Math.max(1, trip.travellerIds.length) : null;
  const covers = fare != null ? w.balance >= fare : null;
  const tail =
    covers === true
      ? " That's enough for this journey."
      : covers === false
        ? " That won't cover this journey's fare yet."
        : "";
  return {
    ok: true,
    speak: `Your Rail Wallet has ${formatFare(w.balance)} available.${tail}`,
    data: { balance: w.balance, currency: w.currency, fare, covers },
  };
}

export function getIdentityStatus(ctx: CopilotContext): ToolResult {
  const id = ctx.identity;
  if (!id) return { ok: false, speak: "I can't see your identity status right now.", error: "no_identity" };
  if (id.status === "verified") {
    return { ok: true, speak: "Your identity is verified and ready.", data: { status: id.status } };
  }
  return {
    ok: true,
    speak: "Your identity isn't verified yet. You can complete it in a few taps before the window opens.",
    data: { status: id.status },
  };
}

export function getTatkalStatus(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  const open = trip.agentState === "window_open" || trip.agentState === "user_action_required";
  const speak = open
    ? "The Tatkal window is open now. Your plan is prepared — we can go when you're ready."
    : `Tatkal opens ${trip.tatkalOpensAtLabel}. I'm watching it for you.`;
  return { ok: true, speak, data: { open, opensAtLabel: trip.tatkalOpensAtLabel, agentState: trip.agentState } };
}

export function getBookingStatus(ctx: CopilotContext): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };
  const b = trip.booking;
  if (!b) {
    return { ok: true, speak: "Nothing's booked yet — your plan is prepared and waiting for the window.", data: { status: "none" } };
  }
  if (b.status === "success") {
    const via = b.recovered ? ` Your backup ${b.finalTrainName} secured it.` : ` Confirmed on ${b.finalTrainName}.`;
    const pay = b.paidVia === "wallet" ? " Paid via your Rail Wallet after the bank was slow." : "";
    return { ok: true, speak: `You're booked.${via}${pay}`, data: { status: b.status, recovered: b.recovered, paidVia: b.paidVia ?? null, pnr: b.pnr ?? null } };
  }
  return { ok: true, speak: `Booking status: ${b.status}. ${b.reason ?? ""}`.trim(), data: { status: b.status } };
}

/* ---------------- Action tools (return validated plans; never execute) ---------------- */

/** Choose the primary train / start preparing — routes into the plan wizard. */
export function prepareJourney(ctx: CopilotContext): ActionPlanResult {
  const trip = needTrip(ctx);
  if (!trip) {
    return {
      ok: false,
      speak: NO_TRIP,
      permission: "preparation",
      requiresConfirmation: false,
      error: "no_trip",
    };
  }
  return {
    ok: true,
    speak: `I'll get ${trip.from} to ${trip.to} prepared — travellers, boarding, and payment.`,
    permission: "preparation",
    requiresConfirmation: false,
    route: { kind: "mission_control", tripId: trip.id },
  };
}

/**
 * Ask to start the booking. Booking is sensitive: it defers to the existing
 * action-validator (Assisted mode requires explicit user initiation) and
 * always requires confirmation before the interface enacts it.
 */
export function requestBookingConfirmation(ctx: CopilotContext): ActionPlanResult {
  const trip = needTrip(ctx);
  if (!trip) {
    return { ok: false, speak: NO_TRIP, permission: "booking", requiresConfirmation: true, error: "no_trip" };
  }
  // Prove we honour the same rules the agent does — never bypass authorization.
  const validation = validateAgentDecision(
    { action: "open_booking_flow", reason: "Copilot user asked to book", source: "local" },
    trip,
    new Set(),
    true // user-initiated: the human asked
  );
  if (!validation.valid) {
    return {
      ok: false,
      speak:
        trip.agentState === "confirmed"
          ? "This journey is already confirmed — nothing more to book."
          : "We can't start booking just yet.",
      permission: "booking",
      requiresConfirmation: true,
      error: validation.code,
    };
  }
  return {
    ok: true,
    speak: `Ready to book ${trip.primary.trainName}. Shall I take you to the booking window?`,
    permission: "booking",
    requiresConfirmation: true,
    route: { kind: "mission_control", tripId: trip.id },
  };
}

/**
 * Open the booking flow directly once confirmation has been given by the user.
 */
export function openBookingFlow(ctx: CopilotContext): ActionPlanResult {
  const trip = needTrip(ctx);
  if (!trip) {
    return { ok: false, speak: NO_TRIP, permission: "booking", requiresConfirmation: false, error: "no_trip" };
  }
  const validation = validateAgentDecision(
    { action: "open_booking_flow", reason: "Copilot user confirmed proceeding to booking", source: "local" },
    trip,
    new Set(),
    true
  );
  if (!validation.valid) {
    return {
      ok: false,
      speak:
        trip.agentState === "confirmed"
          ? "This journey is already confirmed — nothing more to book."
          : "We can't start booking just yet.",
      permission: "booking",
      requiresConfirmation: false,
      error: validation.code,
    };
  }
  return {
    ok: true,
    speak: ctx.lang === "hi"
      ? `बिल्कुल! ${trip.primary.trainName} की तत्काल बुकिंग शुरू कर रहा हूँ।`
      : `Starting the booking flow for ${trip.primary.trainName} now.`,
    permission: "booking",
    requiresConfirmation: false,
    route: { kind: "mission_control", tripId: trip.id },
  };
}

/** Use the backup strategy — booking-level, validated, always confirmed. */

export function useBackupOption(ctx: CopilotContext): ActionPlanResult {
  const trip = needTrip(ctx);
  if (!trip) {
    return { ok: false, speak: NO_TRIP, permission: "booking", requiresConfirmation: true, error: "no_trip" };
  }
  const validation = validateAgentDecision(
    { action: "activate_backup", reason: "Copilot user authorized backup", source: "local" },
    trip,
    new Set(),
    true
  );
  if (!validation.valid) {
    return {
      ok: false,
      speak: trip.backup ? "We can't switch to the backup right now." : "There's no backup prepared for this journey.",
      permission: "booking",
      requiresConfirmation: true,
      error: validation.code,
    };
  }
  return {
    ok: true,
    speak: `I have ${trip.backup?.trainName} ready as your backup. Would you like me to use it?`,
    permission: "booking",
    requiresConfirmation: true,
    route: { kind: "mission_control", tripId: trip.id },
  };
}

export function explainBookingAuthority(ctx: CopilotContext): ToolResult {
  const isAssisted = ctx.trip?.mode === "assisted";
  if (isAssisted) {
    return {
      ok: true,
      speak: "You're in Assisted mode. I can prepare the booking, but I need your confirmation before I start it.",
      data: { mode: "assisted", canAutonomouslyBook: false },
    };
  }
  return {
    ok: true,
    speak: "I'll start your prepared booking strategy.",
    data: { mode: "auto", canAutonomouslyBook: true },
  };
}

export function getBookingStrategies(
  ctx: CopilotContext,
  journeyState?: import("./journey-state").ConversationalJourneyState
): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };

  const primaryName = trip.primary.trainName;
  const backupName = trip.backup?.trainName;
  const fareStr = `₹${trip.fare.toLocaleString("en-IN")}`;
  const maxFareStr = journeyState?.maxFare ? ` within your ₹${journeyState.maxFare} limit` : "";

  let speak = `Your primary strategy is Regular Tatkal on ${primaryName} in ${trip.primary.travelClass} (${fareStr}${maxFareStr}).`;
  if (backupName) {
    speak += ` If unavailable, Copilot will evaluate Premium Tatkal or ${backupName} as your backup strategy.`;
  }

  return {
    ok: true,
    speak,
    data: {
      primary: trip.primary,
      backup: trip.backup,
      constraints: {
        maxFare: journeyState?.maxFare,
        maxPremiumTatkalFare: journeyState?.maxPremiumTatkalFare,
        priceSensitivity: journeyState?.priceSensitivity,
        confirmationPriority: journeyState?.confirmationPriority,
        excludedQuotas: journeyState?.excludedQuotas,
      },
    },
  };
}

export function switchToPremiumTatkal(
  ctx: CopilotContext,
  journeyState?: import("./journey-state").ConversationalJourneyState
): ActionPlanResult {
  const trip = needTrip(ctx);
  if (!trip) {
    return { ok: false, speak: NO_TRIP, permission: "booking", requiresConfirmation: true, error: "no_trip" };
  }

  const ptFare = trip.backup?.fare ?? Math.round(trip.fare * 1.35);
  const validation = validateAgentDecision(
    {
      action: "switch_to_premium_tatkal",
      reason: "User requested switch to Premium Tatkal",
      source: "local",
      toolCall: {
        name: "switchToPremiumTatkal",
        arguments: {
          fare: ptFare,
          maxFare: journeyState?.maxFare,
          maxPremiumTatkalFare: journeyState?.maxPremiumTatkalFare,
        },
      },
    },
    trip,
    new Set(),
    true
  );

  if (!validation.valid) {
    return {
      ok: false,
      speak: `Cannot switch to Premium Tatkal: ${validation.reason}`,
      permission: "booking",
      requiresConfirmation: true,
      error: validation.code,
    };
  }

  return {
    ok: true,
    speak: `Premium Tatkal is available for ₹${ptFare.toLocaleString("en-IN")}. Note that confirmed Premium Tatkal tickets are non-refundable on cancellation. Would you like me to proceed?`,
    permission: "booking",
    requiresConfirmation: true,
    route: { kind: "mission_control", tripId: trip.id },
  };
}

export function explainStrategy(
  ctx: CopilotContext,
  journeyState?: import("./journey-state").ConversationalJourneyState
): ToolResult {
  const trip = needTrip(ctx);
  if (!trip) return { ok: false, speak: NO_TRIP, error: "no_trip" };

  const isPtExcluded = journeyState?.excludedQuotas?.includes("PT");
  let ptNote = "";
  if (isPtExcluded) {
    ptNote = " You have explicitly excluded Premium Tatkal.";
  } else if (journeyState?.maxPremiumTatkalFare) {
    ptNote = ` Premium Tatkal is permitted up to ₹${journeyState.maxPremiumTatkalFare}.`;
  } else if (journeyState?.maxFare) {
    ptNote = ` Total fare ceiling is set to ₹${journeyState.maxFare}.`;
  }

  const speak = `I'll try regular Tatkal first on ${trip.primary.trainName}.${ptNote} If Tatkal runs out, Copilot will switch to your authorized backup option.`;

  return {
    ok: true,
    speak,
    data: {
      tripId: trip.id,
      primaryTrain: trip.primary.trainName,
      backupTrain: trip.backup?.trainName,
      ptExcluded: isPtExcluded,
      maxFare: journeyState?.maxFare,
      maxPtFare: journeyState?.maxPremiumTatkalFare,
    },
  };
}

import type { ConversationalJourneyState } from "./journey-state";

/**
 * Resolves natural origin and destination places, discovers candidate stations,
 * and dynamically ranks candidate journeys with clear explanations.
 */
export function resolveJourney(
  originQuery: string | undefined,
  destQuery: string | undefined,
  ctx: CopilotContext,
  journeyState?: ConversationalJourneyState
): ToolResult {
  // 1. Resolve Origin
  let origin = originQuery ? resolveLocation(originQuery) : null;
  if (!origin && ctx.geolocation) {
    origin = resolveLocationFromCoordinates(ctx.geolocation);
  }
  if (!origin && ctx.trip?.from) {
    origin = resolveLocation(ctx.trip.from);
  }

  if (!origin) {
    const speak = ctx.lang === "hi"
      ? "आप कहाँ से यात्रा शुरू करना चाहते हैं?"
      : "Where are you starting from?";
    return {
      ok: true,
      speak,
      data: { needsOrigin: true, pendingClarification: "origin" },
    };
  }

  // 2. Resolve Destination
  const destination = destQuery ? resolveLocation(destQuery) : null;
  if (!destination) {
    const speak = ctx.lang === "hi"
      ? "आप कहाँ जाना चाहते हैं?"
      : "Where would you like to travel to?";
    return {
      ok: false,
      speak,
      data: { needsDestination: true, pendingClarification: "destination" },
      error: "missing_destination",
    };
  }

  // 3. Rank Candidate Journeys
  const ranking = resolveAndRankJourney(origin, destination, {
    boardingStationPreference: journeyState?.boardingStationPreference,
    excludeStationCode: journeyState?.excludeStationCode,
    preferredClass: journeyState?.travelClass,
    allowClassDowngrade: journeyState?.allowClassDowngrade,
    maxStationDistanceKm: journeyState?.maxStationDistanceKm,
    timeConstraint: journeyState?.timeConstraint,
    directOnly: journeyState?.directOnly,
    priority: journeyState?.priority,
  });

  let probeNote = "";
  let pendingClarification: ConversationalJourneyState["pendingClarification"] = undefined;

  if (ranking.primary) {
    if (!journeyState?.travelDate) {
      pendingClarification = "travelDate";
      probeNote = ctx.lang === "hi"
        ? " आप कब यात्रा करना चाहते हैं — कल, या किसी और दिन?"
        : " When are you planning to travel — tomorrow, or on another date?";
    } else {
      probeNote = ctx.lang === "hi"
        ? " आपकी यात्रा की प्राथमिकताएं सेट हैं। क्या मैं तत्काल बुकिंग के साथ आगे बढ़ूँ?"
        : " All details are in place. Shall I proceed with the booking?";
    }
  }

  return {
    ok: Boolean(ranking.primary),
    speak: ranking.explanation + probeNote,
    data: {
      ...ranking,
      pendingClarification,
    },
  };
}

export async function resolveJourneyAsync(
  originQuery: string | undefined,
  destQuery: string | undefined,
  ctx: CopilotContext,
  journeyState?: ConversationalJourneyState
): Promise<ToolResult> {
  let origin = originQuery ? await (async () => {
    const { resolveLocationAsync } = await import("@/lib/geo/location-resolver");
    return resolveLocationAsync(originQuery);
  })() : null;

  if (!origin && ctx.geolocation) {
    origin = resolveLocationFromCoordinates(ctx.geolocation);
  }
  if (!origin && ctx.trip?.from) {
    origin = resolveLocation(ctx.trip.from);
  }

  if (!origin) {
    const speak = ctx.lang === "hi"
      ? "आप कहाँ से यात्रा शुरू करना चाहते हैं?"
      : "Where are you starting from?";
    return {
      ok: true,
      speak,
      data: { needsOrigin: true, pendingClarification: "origin" },
    };
  }

  const destination = destQuery ? await (async () => {
    const { resolveLocationAsync } = await import("@/lib/geo/location-resolver");
    return resolveLocationAsync(destQuery);
  })() : null;

  if (!destination) {
    const speak = ctx.lang === "hi"
      ? "आप कहाँ जाना चाहते हैं?"
      : "Where would you like to travel to?";
    return {
      ok: false,
      speak,
      data: { needsDestination: true, pendingClarification: "destination" },
      error: "missing_destination",
    };
  }

  const ranking = await resolveAndRankJourneyAsync(origin, destination, {
    boardingStationPreference: journeyState?.boardingStationPreference,
    excludeStationCode: journeyState?.excludeStationCode,
    preferredClass: journeyState?.travelClass,
    allowClassDowngrade: journeyState?.allowClassDowngrade,
    maxStationDistanceKm: journeyState?.maxStationDistanceKm,
    timeConstraint: journeyState?.timeConstraint,
    directOnly: journeyState?.directOnly,
    priority: journeyState?.priority,
  });

  let asyncProbeNote = "";
  let asyncPendingClarification: ConversationalJourneyState["pendingClarification"] = undefined;

  if (ranking.primary) {
    if (!journeyState?.travelDate) {
      asyncPendingClarification = "travelDate";
      asyncProbeNote = ctx.lang === "hi"
        ? " आप कब यात्रा करना चाहते हैं — कल, या किसी और दिन?"
        : " When are you planning to travel — tomorrow, or on another date?";
    } else {
      asyncProbeNote = ctx.lang === "hi"
        ? " आपकी यात्रा की प्राथमिकताएं सेट हैं। क्या मैं तत्काल बुकिंग के साथ आगे बढ़ूँ?"
        : " All details are in place. Shall I proceed with the booking?";
    }
  }

  return {
    ok: Boolean(ranking.primary),
    speak: ranking.explanation + asyncProbeNote,
    data: {
      ...ranking,
      pendingClarification: asyncPendingClarification,
    },
  };
}

/* ---------------- Registry (contract metadata, surfaced to tests/docs) ---------------- */

export const COPILOT_TOOLS: Record<string, CopilotToolMeta> = {
  get_journey_context: { name: "get_journey_context", purpose: "Describe the current journey.", inputs: ["trip"], output: "Origin, destination, date, travellers, mode.", permission: "informational", requiresConfirmation: false },
  get_recommendations: { name: "get_recommendations", purpose: "Explain the recommended primary option.", inputs: ["trip.primary"], output: "Train, class, boarding, confidence.", permission: "informational", requiresConfirmation: false },
  get_backup_option: { name: "get_backup_option", purpose: "Describe the backup strategy.", inputs: ["trip.backup"], output: "Backup train, route, confidence.", permission: "informational", requiresConfirmation: false },
  get_readiness: { name: "get_readiness", purpose: "Report preparation readiness.", inputs: ["trip"], output: "Ready/total and what's missing.", permission: "informational", requiresConfirmation: false },
  get_wallet_balance: { name: "get_wallet_balance", purpose: "Report Rail Wallet balance and coverage.", inputs: ["wallet", "trip.fare"], output: "Balance and whether it covers the fare.", permission: "informational", requiresConfirmation: false },
  get_identity_status: { name: "get_identity_status", purpose: "Report identity verification status.", inputs: ["identity"], output: "Verified or not.", permission: "informational", requiresConfirmation: false },
  get_tatkal_status: { name: "get_tatkal_status", purpose: "Report the Tatkal window status.", inputs: ["trip"], output: "Open now or opens-at label.", permission: "informational", requiresConfirmation: false },
  get_booking_status: { name: "get_booking_status", purpose: "Report the booking status.", inputs: ["trip.booking"], output: "None / confirmed / recovered / failed.", permission: "informational", requiresConfirmation: false },
  explain_booking_authority: { name: "explain_booking_authority", purpose: "Explain mode-based booking authority.", inputs: ["trip.mode"], output: "Assisted vs Permissioned booking behavior.", permission: "informational", requiresConfirmation: false },
  resolve_journey: { name: "resolve_journey", purpose: "Resolve places, candidate stations, and ranked trains.", inputs: ["originQuery", "destQuery"], output: "Ranked trains, stations, and rationale.", permission: "informational", requiresConfirmation: false },
  prepare_journey: { name: "prepare_journey", purpose: "Start preparing the journey.", inputs: ["trip"], output: "A route into Mission Control.", permission: "preparation", requiresConfirmation: false },
  request_booking_confirmation: { name: "request_booking_confirmation", purpose: "Ask to start booking (validated).", inputs: ["trip"], output: "A confirmation-gated plan.", permission: "booking", requiresConfirmation: true },
  open_booking_flow: { name: "open_booking_flow", purpose: "Start the booking flow when confirmed by user.", inputs: ["trip"], output: "A confirmed route into booking window.", permission: "booking", requiresConfirmation: false },
  use_backup_option: { name: "use_backup_option", purpose: "Ask to use the backup (validated).", inputs: ["trip"], output: "A confirmation-gated plan.", permission: "booking", requiresConfirmation: true },

  get_booking_strategies: { name: "get_booking_strategies", purpose: "Report evaluated booking strategies.", inputs: ["trip"], output: "Primary, backup, and quota options.", permission: "informational", requiresConfirmation: false },
  switch_to_premium_tatkal: { name: "switch_to_premium_tatkal", purpose: "Switch to Premium Tatkal strategy (validated).", inputs: ["trip"], output: "A confirmation-gated plan for Premium Tatkal.", permission: "booking", requiresConfirmation: true },
  explain_strategy: { name: "explain_strategy", purpose: "Explain rationale behind chosen booking strategy.", inputs: ["trip"], output: "Strategy explanation and fare limits.", permission: "informational", requiresConfirmation: false },
};

/** Tool names that never require confirmation — pure reads. */
export function isInformational(name: string): boolean {
  return COPILOT_TOOLS[name]?.permission === "informational";
}

/** The permission level for a tool name (or undefined if unknown). */
export function permissionFor(name: string): PermissionLevel | undefined {
  return COPILOT_TOOLS[name]?.permission;
}
