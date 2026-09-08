/**
 * lib/copilot/journey-state.ts
 *
 * Conversational Journey State — multi-turn constraint accumulator.
 *
 * PRINCIPLE:
 *   Every primary/backup recommendation is produced for a specific
 *   `resolutionId`.  Any recommendation whose resolutionId differs from
 *   the current state's resolutionId is STALE and MUST NOT be emitted.
 *
 * ARCHITECTURE:
 *   - This module is pure (no I/O, no store access).
 *   - `extractJourneyConstraints`  — parses a single utterance.
 *   - `mergeJourneyConstraints`    — applies parsed constraints onto the
 *                                    existing state and computes the new
 *                                    resolutionId.
 *   - Callers thread `journeyState` across turns by passing it back into
 *     `executeCopilotTurn` on each subsequent call.
 */

import type { BookingQuota } from "@/lib/booking/types";
import { isInvalidPlaceCandidate } from "@/lib/geo/place-guard";
import { resolveLocation } from "@/lib/geo/location-resolver";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface JourneyTimeConstraint {
  kind: "by" | "before" | "after" | "around" | "at";
  /** 24-hour hour (0-23). */
  hour: number;
  /** Minutes (0-59). */
  minute: number;
  /** Raw text, e.g. "by 9 PM", "after 10". */
  raw: string;
}

/**
 * Live accumulation of user-supplied journey constraints across multiple
 * conversational turns.  Fields are updated incrementally — unchanged
 * constraints survive across turns.
 */
export interface ConversationalJourneyState {
  /** User-stated travel origin (city, locality, or station). */
  originText?: string;
  /** GPS / current location string ("where I am", "current location"). */
  currentLocationText?: string;
  /** User-stated travel destination. */
  destinationText?: string;
  /**
   * Contextual residence declaration ("I live in Pune").
   * Promoted to `originText` ONLY when no explicit origin and no
   * boarding-station preference has been stated in the same utterance.
   */
  residentOf?: string;
  /**
   * Explicit boarding-station preference ("board from Borivali").
   * Does NOT override `originText` — they are distinct concepts.
   */
  boardingStationPreference?: string;
  preferredBoardingStation?: string;
  /** Negative station constraint code / name ("don't want Pune station"). */
  excludeStationCode?: string;
  excludeStationText?: string;
  /** Optimization objective / priority. */
  priority?: "safest" | "cheapest" | "fastest" | "arrival-time";
  /** Travel date: "tomorrow" | "today" | "day_after_tomorrow" */
  travelDate?: string;
  /** Arrival/departure time constraint expressed by the user. */
  timeConstraint?: JourneyTimeConstraint;
  /** Number of passengers (defaults to 1). */
  passengerCount?: number;
  /** Preferred travel class (e.g. "3A", "SL"). */
  travelClass?: string;
  /** Whether class downgrade is explicitly permitted ("any class fine"). */
  allowClassDowngrade?: boolean;
  /** Max acceptable distance to station in km ("within 15 km"). */
  maxStationDistanceKm?: number;
  /** Whether direct train only is required ("no transfers"). */
  directOnly?: boolean;
  /** Maximum acceptable fare for ANY booking strategy */
  maxFare?: number;
  /** Specific maximum acceptable fare ceiling for Premium Tatkal */
  maxPremiumTatkalFare?: number;
  /** Confirmation priority: "low" | "medium" | "high" */
  confirmationPriority?: "low" | "medium" | "high";
  /** Price sensitivity: "low" | "medium" | "high" */
  priceSensitivity?: "low" | "medium" | "high";
  /** Arrival priority: "low" | "medium" | "high" */
  arrivalPriority?: "low" | "medium" | "high";
  /** Allowed booking quotas (e.g. ["TQ", "PT"]) */
  allowedQuotas?: BookingQuota[];
  /** Excluded booking quotas (e.g. ["PT"] if user says "don't use premium tatkal") */
  excludedQuotas?: BookingQuota[];
  /** Whether user permits automatic fallback to Premium Tatkal or alternate */
  allowAutomaticFallback?: boolean;
  /** Pending clarification field requested by Copilot. */
  pendingClarification?: "origin" | "destination" | "travelDate" | "travelClass" | "passengerCount" | "quotaPreference";
  /**
   * Opaque fingerprint of the material constraints.
   *
   * Changes whenever origin, destination, travelDate, timeConstraint,
   * passengerCount, travelClass, boardingStationPreference, excludeStationCode,
   * priority, allowClassDowngrade, maxStationDistanceKm, directOnly, or strategy constraints change.
   *
   * RULE: A primary/backup recommendation is valid ONLY for the
   * resolutionId under which it was produced.  A caller must re-resolve
   * whenever the active resolutionId changes.
   */
  resolutionId: string;
  /** Monotonically increasing turn counter for this session. */
  turnCount: number;
}

/** Constraints extracted from a single utterance. */
export interface ExtractedJourneyConstraints {
  originText?: string;
  currentLocationText?: string;
  destinationText?: string;
  residentOf?: string;
  boardingStationPreference?: string;
  excludeStationCode?: string;
  excludeStationText?: string;
  priority?: "safest" | "cheapest" | "fastest" | "arrival-time";
  travelDate?: string;
  timeConstraint?: JourneyTimeConstraint;
  passengerCount?: number;
  travelClass?: string;
  allowClassDowngrade?: boolean;
  maxStationDistanceKm?: number;
  directOnly?: boolean;
  preferredBoardingStation?: string;
  maxFare?: number;
  maxPremiumTatkalFare?: number;
  confirmationPriority?: "low" | "medium" | "high";
  priceSensitivity?: "low" | "medium" | "high";
  arrivalPriority?: "low" | "medium" | "high";
  allowedQuotas?: BookingQuota[];
  excludedQuotas?: BookingQuota[];
  allowAutomaticFallback?: boolean;
  /** True when the utterance opens with a correction phrase. */
  isCorrection: boolean;
  /** Which semantic fields were explicitly addressed. */
  correctedFields: string[];
}

/** Result of merging extracted constraints into an existing state. */
export interface JourneyMergeResult {
  /** The updated journey state. */
  state: ConversationalJourneyState;
  /**
   * True when a material constraint changed.
   * Callers MUST re-run journey resolution and discard stale
   * recommendations when this is true.
   */
  materialChange: boolean;
  /** Which specific fields changed (for logging / debug). */
  changedFields: string[];
}

/* ------------------------------------------------------------------ */
/* Resolution identity                                                 */
/* ------------------------------------------------------------------ */

/**
 * Compute the opaque fingerprint for the material constraints.
 * Two states with identical fingerprints produce identical journeys —
 * no re-resolution is needed between them.
 */
export function computeResolutionId(
  state: Omit<ConversationalJourneyState, "resolutionId" | "turnCount">
): string {
  const tc = state.timeConstraint;
  const parts = [
    (state.originText ?? state.currentLocationText ?? state.residentOf ?? "").toLowerCase().trim(),
    (state.destinationText ?? "").toLowerCase().trim(),
    (state.travelDate ?? "").toLowerCase().trim(),
    tc ? `${tc.kind}:${tc.hour}:${tc.minute}` : "",
    String(state.passengerCount ?? "unknown"),
    (state.travelClass ?? "").toLowerCase().trim(),
    (state.boardingStationPreference ?? "").toLowerCase().trim(),
    (state.excludeStationCode ?? state.excludeStationText ?? "").toLowerCase().trim(),
    (state.priority ?? "").toLowerCase().trim(),
    String(state.allowClassDowngrade ?? false),
    String(state.maxStationDistanceKm ?? ""),
    String(state.directOnly ?? false),
    String(state.maxFare ?? ""),
    String(state.maxPremiumTatkalFare ?? ""),
    String(state.confirmationPriority ?? ""),
    String(state.priceSensitivity ?? ""),
    String(state.arrivalPriority ?? ""),
    (state.allowedQuotas ?? []).join(","),
    (state.excludedQuotas ?? []).join(","),
    String(state.allowAutomaticFallback ?? ""),
  ];
  return parts.join("|");
}

/* ------------------------------------------------------------------ */
/* Factory helpers                                                     */
/* ------------------------------------------------------------------ */

/** Create an empty journey state for a new session. */
export function createJourneyState(): ConversationalJourneyState {
  return { resolutionId: "", turnCount: 0 };
}

/**
 * Bootstrap journey state from an existing Trip snapshot (e.g. a demo
 * or saved trip).  These values are treated as *demo defaults*: any
 * explicit user-supplied constraint ALWAYS overrides them.
 */
export function journeyStateFromTrip(trip: {
  from: string;
  to: string;
  travelClass?: string;
  travellerIds?: string[];
}): ConversationalJourneyState {
  const partial = {
    originText: trip.from,
    destinationText: trip.to,
    travelClass: trip.travelClass,
    passengerCount: trip.travellerIds && trip.travellerIds.length > 0 ? trip.travellerIds.length : undefined,
  };
  return {
    ...partial,
    resolutionId: computeResolutionId(partial),
    turnCount: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Extraction patterns                                                 */
/* ------------------------------------------------------------------ */

// Correction openers — "Actually", "No I meant", "Change that to", etc.
const CORRECTION_RE =
  /^\s*(?:actually[,\s]?|no[,\s]|no[,\s]+i\s+meant[,\s]?|change\s+that\s+to[,\s]?|make\s+it[,\s]?|wait[,\s]|sorry[,\s]?|not\s+\w+[,\s]+(?:but\s+)?|instead\s+of\s+\w+[,\s]+)/i;

// "I live in Pune"
const I_LIVE_IN_RE =
  /\bi\s+live\s+in\s+([a-z][a-z\s]+?)(?=\s+(?:but|and|,|\.)|\s*$)/i;

// "I'm in Pune", "I am based in Pune", "I am from Pune"
const RESIDENT_OF_RE =
  /\bi(?:'m|\s+am)\s+(?:in|from|based\s+in|living\s+in|a\s+resident\s+of)\s+([a-z][a-z\s]+?)(?=\s+(?:but|and|,|\.)|\s*$)/i;

// "board from Borivali" / "boarding from Borivali"
const BOARD_FROM_RE =
  /\bboard(?:ing)?\s+from\s+([a-z][a-z\s]+?)(?=\s+(?:but|and|,|\.)|\s*$)/i;

// Passenger count words and helper
export const PAX_NUMBER_WORDS: Record<string, number> = {
  one: 1, ek: 1, single: 1, solo: 1, myself: 1,
  two: 2, do: 2, double: 2, pair: 2, couple: 2,
  three: 3, teen: 3,
  four: 4, char: 4,
  five: 5, paanch: 5, panch: 5,
  six: 6, chheh: 6, che: 6,
};

export function parseConversationalPassengerCount(text: string): number | undefined {
  const lower = text.toLowerCase();

  // Pattern 0: "X adults and Y children" / "X adults, Y child"
  const comboMatch = lower.match(/\b(\d+)\s*(?:adults?|persons?|people)\s+(?:and|,)?\s*(\d+)\s*(?:child(?:ren)?|kids?)\b/i);
  if (comboMatch) {
    const adults = parseInt(comboMatch[1], 10);
    const children = parseInt(comboMatch[2], 10);
    const total = adults + children;
    if (total > 0 && total <= 6) return total;
  }

  // Pattern 1: "ticket is for two passengers", "booking for 2 people", "tickets for two", "for 2 travellers"
  const phraseMatch = lower.match(
    /\b(?:tickets?|booking)?\s*(?:is\s+)?(?:for\s+)?(\d+|one|two|three|four|five|six|ek|do|teen|char|paanch|chheh)\s+(?:passengers?|travell?ers?|people|persons?|adults?|seats?|tickets?|log|jana|jan)\b/i
  );
  if (phraseMatch) {
    const raw = phraseMatch[1].toLowerCase();
    const parsed = parseInt(raw, 10);
    const count = !isNaN(parsed) ? parsed : PAX_NUMBER_WORDS[raw];
    if (count && count > 0 && count <= 6) return count;
  }

  // Pattern 2: "hum do log", "hum 2 log", "we two"
  const humMatch = lower.match(/\b(?:hum|we)\s+(\d+|one|two|three|four|five|six|ek|do|teen|char)\s*(?:log|people|jana|jan)?\b/i);
  if (humMatch) {
    const raw = humMatch[1].toLowerCase();
    const parsed = parseInt(raw, 10);
    const count = !isNaN(parsed) ? parsed : PAX_NUMBER_WORDS[raw];
    if (count && count > 0 && count <= 6) return count;
  }

  // Pattern 3: "for two people", "for 2" (in explicit passenger context)
  const forMatch = lower.match(/\b(?:ticket\s+for|booking\s+for)\s+(\d+|one|two|three|four|five|six|ek|do|teen|char)\b/i);
  if (forMatch) {
    const raw = forMatch[1].toLowerCase();
    const parsed = parseInt(raw, 10);
    const count = !isNaN(parsed) ? parsed : PAX_NUMBER_WORDS[raw];
    if (count && count > 0 && count <= 6) return count;
  }

  // Pattern 4: generic "2 passengers", "2 adults", "3 travellers", "4 people", "2 tickets"
  const genericMatch = lower.match(/\b(\d+)\s*(?:passengers?|travell?ers?|people|persons?|adults?|seats?|tickets?)\b/i);
  if (genericMatch) {
    const count = parseInt(genericMatch[1], 10);
    if (count > 0 && count <= 6) return count;
  }

  return undefined;
}

const PAX_RE =
  /\b(\d+)\s+(?:passengers?|travell?ers?|people|persons?|adults?)\b/i;

// Travel class
const CLASS_RE =
  /\b(1a|2a|3a|sl|cc|ec|sleeper|first\s+class|second\s+class|third\s+class|general)\b/i;

// Travel date
const DATE_RE = /\b(tomorrow|today|day\s+after\s+tomorrow|next\s+[a-z]+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

// Numeric time: "by 9 PM", "after 10", "at 22:30", "before 8 AM"
const TIME_NUM_RE =
  /\b(by|before|after|around|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

// Named time of day: "tomorrow evening"
const TIME_WORD_RE =
  /\b(tomorrow|today)\s+(morning|afternoon|evening|night|late\s+night)\b/i;

// "don't want to go to Pune station", "don't use Pune", "avoid Pune station", "skip Pune", "don't want to board from Pune station"
const EXCLUDE_STATION_RE =
  /\b(?:don't|do\s+not|avoid|skip|no|not)\s+(?:want\s+to\s+board\s+from\s+|want\s+to\s+go\s+to\s+|want\s+to\s+use\s+|use\s+|board\s+from\s+|from\s+)?([a-zA-Z][a-zA-Z\s]+?)\s*(?:station|jn|junction)?(?:\s+|$|\.|,)/i;

const PRIORITY_FASTEST_RE = /\b(fastest|quickest|fastest option|quickest option|speed|faster)\b/i;
const PRIORITY_CHEAPEST_RE = /\b(cheaper|cheapest|cheaper option|cheapest option|budget|lowest fare|less fare)\b/i;
const PRIORITY_SAFEST_RE = /\b(safest|safest option|highest confirmation|best chance|highest probability)\b/i;

const ALLOW_CLASS_DOWNGRADE_RE = /\b(any class|all classes|any class is fine|open to any class|sl is fine|sleeper is fine|any class fine|any class okay)\b/i;
const MAX_DISTANCE_RE = /\b(?:within|max|maximum|under|less than|no more than)\s+(\d+)\s*km\b/i;
const DIRECT_ONLY_RE = /\b(direct train|direct only|no connection|no transfers|no connecting train|without connection)\b/i;
const USE_STATION_ONLY_RE =
  /\b(?:use|board\s+from|from)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s+(?:station\s+)?(?:only|hi)\b/i;
const HI_BOARD_STATION_RE =
  /\b([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s*(?:station\s+se\s+hi\s+board|station\s+se\s+board|se\s+hi\s+board)\b/i;
const PREFER_STATION_RE =
  /\b(?:prefer|preferring|rather|use)\s+(?:to\s+use\s+|to\s+board\s+from\s+|from\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)\s*(?:station|jn|junction)?(?:\s+|$|\.|,)/i;

/* ------------------------------------------------------------------ */
/* Time parsing                                                        */
/* ------------------------------------------------------------------ */

function parseTimeConstraint(text: string): JourneyTimeConstraint | undefined {
  const lower = text.toLowerCase();

  // Named period
  const wm = lower.match(TIME_WORD_RE);
  if (wm) {
    const period = wm[2].replace(/\s+/, " ");
    const map: Record<
      string,
      { hour: number; minute: number; kind: JourneyTimeConstraint["kind"] }
    > = {
      morning:      { hour: 10, minute: 0, kind: "by" },
      afternoon:    { hour: 15, minute: 0, kind: "by" },
      evening:      { hour: 18, minute: 0, kind: "after" },
      night:        { hour: 20, minute: 0, kind: "after" },
      "late night": { hour: 22, minute: 0, kind: "after" },
    };
    const slot = map[period] ?? { hour: 18, minute: 0, kind: "after" };
    return { ...slot, raw: wm[0] };
  }

  // Numeric time
  const nm = text.match(TIME_NUM_RE);
  if (!nm) return undefined;

  const [, kindRaw, hourStr, minuteStr, ampm] = nm;
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
  const kind = kindRaw.toLowerCase() as JourneyTimeConstraint["kind"];

  if (ampm) {
    // Explicit AM/PM
    if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
  } else {
    // Ambiguous — in the context of travel planning assume PM for hours ≤ 12.
    // Users say "by 7 AM" explicitly when they mean morning; "by 9" or "after 10"
    // without qualifier almost always means evening in Indian rail context.
    if (hour <= 12) {
      hour += 12;
      if (hour === 24) hour = 0; // midnight edge case
    }
  }

  return { kind, hour, minute, raw: nm[0] };
}

/* ------------------------------------------------------------------ */
/* Main extractor                                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract all journey-relevant constraints from a single utterance.
 *
 * Handles:
 *  - Correction phrases ("Actually", "No I meant", "Make it", ...)
 *  - Explicit origin/destination ("from Pune to Delhi")
 *  - Negative station constraint ("I don't want to go to Pune station")
 *  - Destination-only corrections ("Actually Delhi")
 *  - Origin-only corrections ("Actually from Mumbai")
 *  - Residential context ("I live in Pune") → sets `residentOf` NOT `origin`
 *  - Boarding preference ("board from Borivali")
 *  - Optimization objectives / priority ("fastest option", "cheaper option")
 *  - Time semantics ("by 9 PM", "after 10", "tomorrow evening")
 *  - Travel date ("tomorrow", "today")
 *  - Passenger count ("2 passengers")
 *  - Travel class ("3A", "sleeper")
 */
export function extractJourneyConstraints(
  text: string,
  pendingClarification?: ConversationalJourneyState["pendingClarification"]
): ExtractedJourneyConstraints {
  const correctedFields: string[] = [];
  const isCorrection = CORRECTION_RE.test(text);

  let originText: string | undefined;
  let destinationText: string | undefined;
  let residentOf: string | undefined;
  let boardingStationPreference: string | undefined;
  let excludeStationCode: string | undefined;
  let excludeStationText: string | undefined;
  let priority: "safest" | "cheapest" | "fastest" | "arrival-time" | undefined;
  let travelDate: string | undefined;
  let timeConstraint: JourneyTimeConstraint | undefined;
  let passengerCount: number | undefined;
  let travelClass: string | undefined;
  let allowClassDowngrade: boolean | undefined;
  let maxStationDistanceKm: number | undefined;
  let directOnly: boolean | undefined;
  let allowedQuotas: BookingQuota[] | undefined;
  let excludedQuotas: BookingQuota[] | undefined;
  let allowAutomaticFallback: boolean | undefined;

  // ── Pending clarification contextual resolution ───────────────────
  // When Copilot explicitly asked "Where are you starting from?" or "Where would you like to travel?",
  // interpret short standalone utterances relative to that pending question.
  const ignorableWords = [
    "the", "a", "an", "yes", "no", "ok", "okay", "okie", "sure", "cancel", "stop",
    "hmm", "hm", "right", "got it", "fine", "alright", "all right", "haan", "theek hai",
    "theek", "ha", "achha", "acha", "accha", "yep", "yeah", "yup", "done", "cool"
  ];

  if (pendingClarification === "origin") {
    const isExplicitToVerb = /\b(?:to|reach|go\s+to|tickets?\s+to)\s+[a-zA-Z]/i.test(text);
    if (!isExplicitToVerb) {
      const cleaned = text.replace(/^[,\s\.]*|[,\s\.]*$/g, "").trim();
      const stripped = cleaned.replace(/^(?:from|starting\s+from|start\s+from|i'm\s+in|i\s+am\s+in|in|at|living\s+in|live\s+in)\s+/i, "").trim();
      if (stripped && !ignorableWords.includes(stripped.toLowerCase())) {
        originText = stripped;
        correctedFields.push("origin");
      }
    }
  } else if (pendingClarification === "destination") {
    const isExplicitFromVerb = /\b(?:from|starting\s+from|board\s+from)\s+[a-zA-Z]/i.test(text);
    if (!isExplicitFromVerb) {
      const cleaned = text.replace(/^[,\s\.]*|[,\s\.]*$/g, "").trim();
      const stripped = cleaned.replace(/^(?:to|going\s+to|reach|want\s+to\s+go\s+to|for)\s+/i, "").trim();
      if (stripped && !ignorableWords.includes(stripped.toLowerCase())) {
        destinationText = stripped;
        correctedFields.push("destination");
      }
    }
  } else if (pendingClarification === "travelDate") {
    const dateM = text.toLowerCase().match(DATE_RE);
    if (dateM) {
      travelDate = dateM[1] === "day after tomorrow" ? "day_after_tomorrow" : dateM[1];
      correctedFields.push("travelDate");
    } else {
      const cleaned = text.replace(/^[,\s\.]*|[,\s\.]*$/g, "").trim();
      const ignorableWords = ["the", "a", "an", "cancel", "stop"];
      const isAffirmative = /^(?:yes|proceed|go ahead|haan|sure|ok|okay|yep|yeah|chalo)\b/i.test(cleaned);
      if (isAffirmative) {
        travelDate = "tomorrow";
        correctedFields.push("travelDate");
      } else if (cleaned && !ignorableWords.includes(cleaned.toLowerCase())) {
        travelDate = cleaned;
        correctedFields.push("travelDate");
      }
    }
  } else if (pendingClarification === "travelClass") {
    const classM = text.toLowerCase().match(CLASS_RE);
    if (classM) {
      const raw = classM[1].replace(/\s+/g, "").toUpperCase();
      const classMap: Record<string, string> = {
        SLEEPER: "SL",
        FIRSTCLASS: "1A",
        SECONDCLASS: "2A",
        THIRDCLASS: "3A",
      };
      travelClass = classMap[raw] ?? raw;
      correctedFields.push("travelClass");
    } else if (/^(?:3a|2a|1a|sl|3e|cc|2s|ec)$/i.test(text.trim())) {
      travelClass = text.trim().toUpperCase();
      correctedFields.push("travelClass");
    }
    const parsedPax = parseConversationalPassengerCount(text);
    if (parsedPax !== undefined) {
      passengerCount = parsedPax;
      correctedFields.push("passengerCount");
    }
  } else if (pendingClarification === "passengerCount") {
    const parsedPax = parseConversationalPassengerCount(text);
    if (parsedPax !== undefined) {
      passengerCount = parsedPax;
      correctedFields.push("passengerCount");
    } else {
      const num = parseInt(text.trim(), 10);
      if (!isNaN(num) && num > 0 && num <= 6) {
        passengerCount = num;
        correctedFields.push("passengerCount");
      } else {
        const matched = PAX_NUMBER_WORDS[text.toLowerCase().trim()];
        if (matched) {
          passengerCount = matched;
          correctedFields.push("passengerCount");
        }
      }
    }
  } else if (pendingClarification === "quotaPreference") {
    if (/\b(?:yes|haan|ha|yeah|yup|sure|ok|okay|include|keep|definitely|chahiye|kar do|add|enable|proceed|go\s+ahead|please)\b/i.test(text)) {
      allowedQuotas = ["TQ", "PT"];
      allowAutomaticFallback = true;
      correctedFields.push("allowedQuotas");
    } else if (/\b(?:no|nahi|nah|don't|only\s+regular|only\s+tatkal|skip|mat|exclude)\b/i.test(text)) {
      excludedQuotas = ["PT"];
      allowedQuotas = ["TQ", "GN"];
      correctedFields.push("excludedQuotas");
    }
  }

  if (!allowedQuotas && !excludedQuotas) {
    if (/\b(?:use|include|enable|with|keep)\s+(?:premium\s+tatkal|pt)\b/i.test(text)) {
      allowedQuotas = ["TQ", "PT"];
      allowAutomaticFallback = true;
      correctedFields.push("allowedQuotas");
    } else if (/\b(?:don't\s+use|do\s+not\s+use|skip|no|without|exclude)\s+(?:premium\s+tatkal|pt)\b/i.test(text)) {
      excludedQuotas = ["PT"];
      allowedQuotas = ["TQ", "GN"];
      correctedFields.push("excludedQuotas");
    }
  }

  // ── Negative station constraint ("don't want Pune station", "avoid Pune")
  const excludeM = text.match(EXCLUDE_STATION_RE);
  if (excludeM) {
    const rawExclude = excludeM[1].trim();
    if (!["there", "it", "any", "this", "that"].includes(rawExclude.toLowerCase())) {
      excludeStationText = rawExclude;
      excludeStationCode = rawExclude.toUpperCase();
      correctedFields.push("excludeStation");
    }
  }

  // ── Optimization priority ("fastest option", "cheaper option")
  if (PRIORITY_FASTEST_RE.test(text)) {
    priority = "fastest";
    correctedFields.push("priority");
  } else if (PRIORITY_CHEAPEST_RE.test(text)) {
    priority = "cheapest";
    correctedFields.push("priority");
  } else if (PRIORITY_SAFEST_RE.test(text)) {
    priority = "safest";
    correctedFields.push("priority");
  }

  if (ALLOW_CLASS_DOWNGRADE_RE.test(text)) {
    allowClassDowngrade = true;
    correctedFields.push("allowClassDowngrade");
  }

  const distM = text.match(MAX_DISTANCE_RE);
  if (distM) {
    maxStationDistanceKm = parseInt(distM[1], 10);
    correctedFields.push("maxStationDistanceKm");
  }

  if (DIRECT_ONLY_RE.test(text)) {
    directOnly = true;
    correctedFields.push("directOnly");
  }

  // ── Boarding preference (check before residential so "board from X" wins)
  let preferredBoardingStation: string | undefined;
  const boardM =
    text.match(USE_STATION_ONLY_RE) ??
    text.match(HI_BOARD_STATION_RE) ??
    text.match(BOARD_FROM_RE) ??
    text.match(PREFER_STATION_RE);
  if (boardM) {
    boardingStationPreference = boardM[1].trim();
    preferredBoardingStation = boardingStationPreference;
    correctedFields.push("boardingStationPreference");
    correctedFields.push("preferredBoardingStation");
  }

  // ── Residential context ("I live in Pune", "I'm in Pune")
  const resM = text.match(I_LIVE_IN_RE) ?? text.match(RESIDENT_OF_RE);
  if (resM) {
    residentOf = resM[1].trim();
    if (!correctedFields.includes("residentOf")) correctedFields.push("residentOf");
  }

  // ── Explicit "from X to Y" or "to Y from X" patterns
  const fromToM =
    text.match(
      /\b(?:from|starting\s+from|start\s+from)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:to|reach|for)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|parso|early|morning|shaam|evening|night|subah|before|after|by|in|at|\d+[a-zA-Z]*|[1-3][aA]|sl|cc|ec|2s)|\.|,|$)/i
    ) ??
    text.match(
      /^\s*(?:actually|no,?\s*|make\s+it)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+to\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)(?:\s+(?:tomorrow|today|kal|parso|early|morning|shaam|evening|night|subah|before|after|by|in|at|\d+[a-zA-Z]*|[1-3][aA]|sl|cc|ec|2s)|\.|,|$)/i
    );
  if (fromToM) {
    const candOrig = fromToM[1].replace(/^(?:actually|no|make\s+it)\s+/i, "").trim();
    const candDest = fromToM[2].trim();
    if (!isInvalidPlaceCandidate(candOrig) && !isInvalidPlaceCandidate(candDest)) {
      originText = candOrig;
      destinationText = candDest;
      if (!correctedFields.includes("origin")) correctedFields.push("origin");
      if (!correctedFields.includes("destination")) correctedFields.push("destination");
    }
  }

  if (!originText || !destinationText) {
    const toFromM = text.match(
      /(?:travel\s+to|tickets?\s+to|going\s+to|go\s+to|reach|\bto\b)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:from|starting\s+from|start\s+from)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at)|\.|,|$)/i
    );
    if (toFromM) {
      const candDest = toFromM[1].trim();
      const candOrig = toFromM[2].trim();
      if (!isInvalidPlaceCandidate(candOrig) && !isInvalidPlaceCandidate(candDest)) {
        destinationText = candDest;
        originText = candOrig;
        if (!correctedFields.includes("origin")) correctedFields.push("origin");
        if (!correctedFields.includes("destination")) correctedFields.push("destination");
      }
    }
  }

  if (!originText || !destinationText) {
    const inReachM = text.match(
      /\b(?:i'm\s+at|i\s+am\s+at|i'm\s+in|i\s+am\s+in|\bin\b|\bat\b|live\s+in)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:and\s+need\s+to\s+reach|and\s+want\s+to\s+go\s+to|and\s+going\s+to|need\s+to\s+reach|going\s+to|and\s+i\s+want\s+to\s+go\s+to|i\s+want\s+to\s+go\s+to|want\s+to\s+reach|want\s+to\s+go\s+to)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at|instead|though)|\.|,|$)/i
    );
    if (inReachM) {
      const candOrig = inReachM[1].trim();
      const candDest = inReachM[2].trim();
      if (!isInvalidPlaceCandidate(candOrig) && !isInvalidPlaceCandidate(candDest)) {
        originText = candOrig;
        destinationText = candDest;
        if (!correctedFields.includes("origin")) correctedFields.push("origin");
        if (!correctedFields.includes("destination")) correctedFields.push("destination");
      }
    }
  }

  // ── Destination-only verb ("go to Delhi", "take me to Delhi", "tickets to Delhi", etc.)
  // Skip if text is expressing negative station preference or pending clarification was origin (unless explicit correction)
  if (!destinationText && !excludeStationText && (pendingClarification !== "origin" || isCorrection)) {
    const toOnlyM = text.match(
      /(?:take\s+me\s+to|travel\s+to|tickets?\s+to|going\s+to|go\s+to|reach|want\s+to\s+go\s+to|i\s+want\s+to\s+go\s+to|i\s+need\s+to\s+go\s+to|\b(?:i\s+want|want)(?!\s+(?:to\b|a\b|the\b|my\b|our\b|tickets?\b|trains?\b))|\btowards\b)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at|instead|though|and|from|with|for|as)|\.|,|$)/i
    );
    if (toOnlyM) {
      const candidate = toOnlyM[1].trim();
      if (!isInvalidPlaceCandidate(candidate)) {
        destinationText = candidate;
        if (!correctedFields.includes("destination"))
          correctedFields.push("destination");
      }
    }
  }

  // ── Standalone origin ("from Mumbai", "starting from Chennai", "I want to start my journey from Pune")
  if (!originText && !boardingStationPreference && !excludeStationText && (pendingClarification !== "destination" || isCorrection)) {
    const originCorrM = text.match(
      /(?:start(?:ing)?\s+(?:my\s+|a\s+|the\s+)?journey\s+from|from|starting\s+from|start\s+from)\s+([A-Za-z][a-z\s]+?)(?:\s|,|\.|$)/i
    );
    if (originCorrM && !fromToM) {
      const cand = originCorrM[1].trim();
      if (!isInvalidPlaceCandidate(cand)) {
        originText = cand;
        if (!correctedFields.includes("origin")) correctedFields.push("origin");
      }
    }
  }

  // ── Correction: standalone destination ("Actually Delhi", "Make it Pune",
  //    "Not Chennai, Delhi")
  //    Guard: require isCorrection and skip pronouns / common verbs
  if (!destinationText && !boardingStationPreference && !excludeStationText && isCorrection) {
    const stripped = text.replace(CORRECTION_RE, "").trim();
    const destM = stripped.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s|,|\.|\b|$)/);
    const ignorable = [
      "I", "Me", "We", "My", "It", "No", "Yes", "Actually", "Switch", "Show",
      "Use", "Book", "Prepare", "Cancel", "What", "How", "Can", "Please", "Retry"
    ];
    if (destM && !ignorable.includes(destM[1].trim())) {
      destinationText = destM[1].trim();
      if (!correctedFields.includes("destination"))
        correctedFields.push("destination");
    }
  }

  // ── Travel date
  const dateM = text.toLowerCase().match(DATE_RE);
  if (dateM) {
    travelDate =
      dateM[1] === "day after tomorrow"
        ? "day_after_tomorrow"
        : dateM[1];
    if (!correctedFields.includes("travelDate")) correctedFields.push("travelDate");
  }

  // ── Time constraint
  timeConstraint = parseTimeConstraint(text);
  if (timeConstraint && !correctedFields.includes("timeConstraint")) {
    correctedFields.push("timeConstraint");
  }

  // ── Passenger count
  const parsedPax = parseConversationalPassengerCount(text);
  if (parsedPax !== undefined) {
    passengerCount = parsedPax;
    correctedFields.push("passengerCount");
  }

  // ── Travel class
  const classM = text.toLowerCase().match(CLASS_RE);
  if (classM) {
    const raw = classM[1].replace(/\s+/g, "").toUpperCase();
    const classMap: Record<string, string> = {
      SLEEPER: "SL",
      FIRSTCLASS: "1A",
      SECONDCLASS: "2A",
      THIRDCLASS: "3A",
    };
    travelClass = classMap[raw] ?? raw;
    correctedFields.push("travelClass");
  }

  // ── Strategy Constraints Extraction (TASK 5H)
  let maxFare: number | undefined;
  let maxPremiumTatkalFare: number | undefined;
  let confirmationPriority: "low" | "medium" | "high" | undefined;
  let priceSensitivity: "low" | "medium" | "high" | undefined;
  let arrivalPriority: "low" | "medium" | "high" | undefined;


  // 1. Quota allowance & exclusions
  const lowerText = text.toLowerCase();
  const isExcludePt =
    /\b(?:don't|do\s+not|never|exclude|skip|no|without|mat)\s+(?:use\s+|want\s+|try\s+|lena\s+|lo\s+)?(?:premium\s+tatkal|pt)\b/i.test(text) ||
    /(?:premium\s+tatkal|pt|प्रीमियम\s+तत्काल)[\s\S]*?(?:mat\s+use|mat\s+lagao|nahi\s+chahiye|mat\s+karo|mat\s+lena|mat\s+lo|mat\s+le|nahi\s+lena|मत\s+use|मत\s+लगाओ|नहीं\s+चाहिए|मत\s+लेना)/i.test(text) ||
    /(?:mat\s+lena|mat\s+lo|mat\s+karo|nahi\s+chahiye|मत\s+लेना|नहीं\s+चाहिए)[\s\S]*?(?:premium\s+tatkal|pt|प्रीमियम\s+तत्काल)/i.test(text);

  const isAllowPt =
    /\b(?:use|try|consider|allow|prefer)\s+(?:premium\s+tatkal|pt)\b/i.test(text) ||
    /\b(?:premium\s+tatkal|pt)\b[\s\S]*?(?:is\s+okay|is\s+fine|chalega|try\s+kar\s+lena|if\s+needed|if\s+necessary|nahi\s+mila\s+toh)/i.test(text) ||
    /(?:प्रीमियम\s+तत्काल|pt)[\s\S]*?(?:try\s+कर\s+लेना|चलेगा|chalega|try\s+kar\s+lena)/i.test(text);

  if (isExcludePt) {
    excludedQuotas = ["PT"];
    allowedQuotas = ["TQ", "GN"];
    correctedFields.push("excludedQuotas");
  } else if (isAllowPt) {
    allowedQuotas = ["TQ", "PT"];
    correctedFields.push("allowedQuotas");
  }

  // 2. Automatic fallback
  if (
    /\b(automatic fallback|automatically|switch automatically|khud switch|khud kar lena|auto fallback|can switch)\b/i.test(text) ||
    /(?:खुद\s+स्विच|ऑटोमैटिक|अपने\s+आप)/i.test(text)
  ) {
    allowAutomaticFallback = true;
    correctedFields.push("allowAutomaticFallback");
  }

  // 3. Fares & Ceilings
  // Check for Hindi word amounts
  const has4000 = /4000|chaar\s*hazar|char\s*hazar|चार\s*हज़ार|चार\s*हजार/i.test(text);
  const has3000 = /3000|teen\s*hazar|तीन\s*हज़ार|तीन\s*हजार/i.test(text);
  const has2500 = /2500|dhai\s*hazar|ढाई\s*हज़ार/i.test(text);
  const has2000 = /2000|do\s*hazar|दो\s*हज़ार|दो\s*हजार/i.test(text);
  const has5000 = /5000|paanch\s*hazar|पांच\s*हज़ार/i.test(text);

  let detectedAmount: number | undefined;
  if (has4000) detectedAmount = 4000;
  else if (has3000) detectedAmount = 3000;
  else if (has2500) detectedAmount = 2500;
  else if (has2000) detectedAmount = 2000;
  else if (has5000) detectedAmount = 5000;
  else {
    const amountMatch = text.match(/[₹Rs\.]*\s*(\d{3,6})/);
    if (amountMatch) detectedAmount = parseInt(amountMatch[1], 10);
  }

  if (detectedAmount) {
    const isPtSpecific =
      /(?:premium\s+tatkal|pt|प्रीमियम\s+तत्काल)[\s\S]*?(?:up\s+to|below|under|max|spend|tak|se\s+zyada\s+nahi|तक|से\s+ज़्यादा\s+नहीं)/i.test(text) ||
      /(?:up\s+to|below|under|max|spend)[\s\S]*?(?:premium\s+tatkal|pt)/i.test(text);

    if (isPtSpecific) {
      maxPremiumTatkalFare = detectedAmount;
      correctedFields.push("maxPremiumTatkalFare");
    } else {
      maxFare = detectedAmount;
      correctedFields.push("maxFare");
    }
  }

  // 4. Price Sensitivity
  if (
    /\b(cheapest|cheapest option|lowest fare|less fare|budget option|sasta|sabse sasta|as cheap as possible)\b/i.test(text) ||
    /सस्ता|कम\s+किराया/i.test(text)
  ) {
    priceSensitivity = "high";
    correctedFields.push("priceSensitivity");
  } else if (
    /\b(don't care about price|price doesn't matter|don't mind paying extra|don't mind paying more|pay more|cost doesn't matter|paisa koi issue nahi|paise ki chinta nahi)\b/i.test(text) ||
    /पैसे\s+की\s+चिंता\s+नहीं|पैसा\s+कोई\s+इशू\s+नहीं/i.test(text)
  ) {
    priceSensitivity = "low";
    correctedFields.push("priceSensitivity");
  }

  // 5. Confirmation Priority
  if (
    /\b(highest chance|best chance|highest confirmation|highest probability|need to get there|must reach|need to reach|absolutely need|pakka confirm|confirmed ticket|sabse zyada chance|sabse jyada chance|confirm hone ke)\b/i.test(text) ||
    /पक्का\s+कन्फर्म|कन्फर्म\s+चाहिए|ज़रूर\s+पहुंचना|सबसे\s+ज़्यादा\s+चांस/i.test(text)
  ) {
    confirmationPriority = "high";
    correctedFields.push("confirmationPriority");
  }

  // 6. Arrival Priority
  if (
    /\b(reach before|arrive before|reach by|early morning|urgent arrival|pehle pahunchna)\b/i.test(text) ||
    /पहले\s+पहुंचना|सुबह\s+पहुंचना/i.test(text)
  ) {
    arrivalPriority = "high";
    correctedFields.push("arrivalPriority");
  }

  return {
    originText,
    destinationText,
    residentOf,
    boardingStationPreference,
    preferredBoardingStation,
    excludeStationCode,
    excludeStationText,
    priority,
    travelDate,
    timeConstraint,
    passengerCount,
    travelClass,
    allowClassDowngrade,
    maxStationDistanceKm,
    directOnly,
    maxFare,
    maxPremiumTatkalFare,
    confirmationPriority,
    priceSensitivity,
    arrivalPriority,
    allowedQuotas,
    excludedQuotas,
    allowAutomaticFallback,
    isCorrection,
    correctedFields,
  };
}

/* ------------------------------------------------------------------ */
/* State merger                                                        */
/* ------------------------------------------------------------------ */

/**
 * Merge extracted constraints into the existing journey state.
 *
 * Rules:
 *  1. Explicit `originText` always overrides.
 *  2. Explicit `destinationText` always overrides.
 *  3. `residentOf` promotes to `originText` ONLY when no explicit origin
 *     is present in the utterance AND no boarding-station preference was
 *     stated in the SAME utterance.  If the user says "I live in Pune
 *     but board from Mumbai", Pune becomes the origin, Mumbai the boarding
 *     pref — neither overrides the other.
 *  4. `boardingStationPreference` is stored separately and does NOT
 *     change `originText`.
 *  5. `excludeStationCode` / `excludeStationText` updates negative station constraints.
 *  6. `priority` updates optimization objective ("fastest", "cheapest", etc.).
 *  7. All other fields override when newly supplied.
 *  8. A new `resolutionId` is computed.  Any recommendation produced
 *     under the OLD resolutionId MUST be discarded.
 */
export function mergeJourneyConstraints(
  existing: ConversationalJourneyState,
  extracted: ExtractedJourneyConstraints
): JourneyMergeResult {
  const next: ConversationalJourneyState = {
    ...existing,
    pendingClarification: existing.pendingClarification,
    turnCount: existing.turnCount + 1,
  };
  const changedFields: string[] = [];

  // 1. Explicit origin
  if (extracted.originText) {
    const norm = extracted.originText.toLowerCase().trim();
    if (norm !== (existing.originText ?? "").toLowerCase().trim()) {
      next.originText = extracted.originText;
      changedFields.push("origin");
    }
    if (next.pendingClarification === "origin") {
      next.pendingClarification = undefined;
    }
  }

  // 2. Explicit destination
  if (extracted.destinationText) {
    const norm = extracted.destinationText.toLowerCase().trim();
    if (norm !== (existing.destinationText ?? "").toLowerCase().trim()) {
      next.destinationText = extracted.destinationText;
      changedFields.push("destination");
    }
    if (next.pendingClarification === "destination") {
      next.pendingClarification = undefined;
    }
  }

  // 3. Residential context → promote to origin
  if (extracted.residentOf && !extracted.originText) {
    next.residentOf = extracted.residentOf;
    const hasInlineBoardingPref = Boolean(extracted.boardingStationPreference);
    const hasEstablishedOrigin = Boolean(existing.originText);
    const shouldPromote = extracted.isCorrection || !hasInlineBoardingPref || !hasEstablishedOrigin;
    if (shouldPromote) {
      const norm = extracted.residentOf.toLowerCase().trim();
      if (norm !== (existing.originText ?? "").toLowerCase().trim()) {
        next.originText = extracted.residentOf;
        changedFields.push("origin");
      }
      if (next.pendingClarification === "origin") {
        next.pendingClarification = undefined;
      }
    }
  }

  // 4. Boarding station preference
  if (extracted.boardingStationPreference) {
    const norm = extracted.boardingStationPreference.toLowerCase().trim();
    if (norm !== (existing.boardingStationPreference ?? "").toLowerCase().trim()) {
      next.boardingStationPreference = extracted.boardingStationPreference;
      next.preferredBoardingStation = extracted.preferredBoardingStation ?? extracted.boardingStationPreference;
      changedFields.push("boardingStationPreference");
    }
    if (!extracted.originText && !extracted.residentOf) {
      next.originText = existing.originText; // preserve
    }
  }

  // 5. Negative station constraint ("don't want Pune station")
  if (extracted.excludeStationCode || extracted.excludeStationText) {
    const code = (extracted.excludeStationCode ?? extracted.excludeStationText ?? "").toUpperCase().trim();
    if (code !== (existing.excludeStationCode ?? "").toUpperCase().trim()) {
      next.excludeStationCode = code;
      next.excludeStationText = extracted.excludeStationText;
      changedFields.push("excludeStation");
    }
    // Conflict override: If excludeStation matches active boardingStationPreference, clear boardingStationPreference
    if (
      next.boardingStationPreference &&
      (code.includes(next.boardingStationPreference.toUpperCase().trim()) ||
        next.boardingStationPreference.toUpperCase().trim().includes(code))
    ) {
      next.boardingStationPreference = undefined;
      changedFields.push("boardingStationPreference");
    }
  }

  // 6. Optimization priority ("fastest option", "cheaper option")
  if (extracted.priority && extracted.priority !== existing.priority) {
    next.priority = extracted.priority;
    changedFields.push("priority");
  }

  // 7. Travel date
  if (extracted.travelDate && extracted.travelDate !== existing.travelDate) {
    next.travelDate = extracted.travelDate;
    changedFields.push("travelDate");
    if (next.pendingClarification === "travelDate") {
      next.pendingClarification = undefined;
    }
  }

  // 8. Time constraint
  if (extracted.timeConstraint) {
    const ex = existing.timeConstraint;
    const nx = extracted.timeConstraint;
    const changed =
      !ex ||
      ex.kind !== nx.kind ||
      ex.hour !== nx.hour ||
      ex.minute !== nx.minute;
    if (changed) {
      next.timeConstraint = nx;
      changedFields.push("timeConstraint");
    }
  }

  // 9. Passenger count
  if (
    extracted.passengerCount !== undefined &&
    extracted.passengerCount !== existing.passengerCount
  ) {
    next.passengerCount = extracted.passengerCount;
    changedFields.push("passengerCount");
    if (next.pendingClarification === "passengerCount") {
      next.pendingClarification = undefined;
    }
  }

  // 10. Travel class
  if (extracted.travelClass && extracted.travelClass !== existing.travelClass) {
    next.travelClass = extracted.travelClass;
    changedFields.push("travelClass");
    if (next.pendingClarification === "travelClass") {
      next.pendingClarification = undefined;
    }
  }

  // 11. Allow class downgrade
  if (extracted.allowClassDowngrade !== undefined && extracted.allowClassDowngrade !== existing.allowClassDowngrade) {
    next.allowClassDowngrade = extracted.allowClassDowngrade;
    changedFields.push("allowClassDowngrade");
  }

  // 12. Max station distance
  if (extracted.maxStationDistanceKm !== undefined && extracted.maxStationDistanceKm !== existing.maxStationDistanceKm) {
    next.maxStationDistanceKm = extracted.maxStationDistanceKm;
    changedFields.push("maxStationDistanceKm");
  }

  // 13. Direct only
  if (extracted.directOnly !== undefined && extracted.directOnly !== existing.directOnly) {
    next.directOnly = extracted.directOnly;
    changedFields.push("directOnly");
  }

  // 14. Max Fare limit
  if (extracted.maxFare !== undefined && extracted.maxFare !== existing.maxFare) {
    next.maxFare = extracted.maxFare;
    changedFields.push("maxFare");
  }

  // 15. Max Premium Tatkal Fare limit
  if (extracted.maxPremiumTatkalFare !== undefined && extracted.maxPremiumTatkalFare !== existing.maxPremiumTatkalFare) {
    next.maxPremiumTatkalFare = extracted.maxPremiumTatkalFare;
    changedFields.push("maxPremiumTatkalFare");
  }

  // 16. Confirmation priority
  if (extracted.confirmationPriority && extracted.confirmationPriority !== existing.confirmationPriority) {
    next.confirmationPriority = extracted.confirmationPriority;
    changedFields.push("confirmationPriority");
  }

  // 17. Price sensitivity
  if (extracted.priceSensitivity && extracted.priceSensitivity !== existing.priceSensitivity) {
    next.priceSensitivity = extracted.priceSensitivity;
    changedFields.push("priceSensitivity");
  }

  // 18. Arrival priority
  if (extracted.arrivalPriority && extracted.arrivalPriority !== existing.arrivalPriority) {
    next.arrivalPriority = extracted.arrivalPriority;
    changedFields.push("arrivalPriority");
  }

  // 19. Allowed quotas
  if (extracted.allowedQuotas) {
    next.allowedQuotas = extracted.allowedQuotas;
    changedFields.push("allowedQuotas");
    if (next.pendingClarification === "quotaPreference") {
      next.pendingClarification = undefined;
    }
  }

  // 20. Excluded quotas
  if (extracted.excludedQuotas) {
    next.excludedQuotas = extracted.excludedQuotas;
    changedFields.push("excludedQuotas");
    if (next.pendingClarification === "quotaPreference") {
      next.pendingClarification = undefined;
    }
  }

  // 21. Automatic fallback
  if (extracted.allowAutomaticFallback !== undefined && extracted.allowAutomaticFallback !== existing.allowAutomaticFallback) {
    next.allowAutomaticFallback = extracted.allowAutomaticFallback;
    changedFields.push("allowAutomaticFallback");
  }

  // Recompute resolutionId
  const newId = computeResolutionId(next);
  const materialChange = newId !== existing.resolutionId;
  next.resolutionId = newId;

  return { state: next, materialChange, changedFields };
}

/**
 * Compare two place names, considering casing, substrings, and railway/city aliases
 * (e.g. Bangalore vs Bengaluru, Delhi vs New Delhi, Bombay vs Mumbai).
 */
export function placesMatch(placeA: string, placeB: string): boolean {
  if (!placeA || !placeB) return true;
  const normA = placeA.toLowerCase().trim();
  const normB = placeB.toLowerCase().trim();
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
    return true;
  }
  const locA = resolveLocation(normA);
  const locB = resolveLocation(normB);
  if (locA && locB) {
    if (locA.matchedStationCode && locB.matchedStationCode && locA.matchedStationCode === locB.matchedStationCode) {
      return true;
    }
    if (locA.city && locB.city && locA.city.toLowerCase() === locB.city.toLowerCase()) {
      return true;
    }
    if (locA.name && locB.name && locA.name.toLowerCase() === locB.name.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether `inputTrip` is stale relative to the current journey state.
 *
 * A trip is stale when the user has since changed the origin or destination
 * to something that no longer matches the trip on record.  Stale trips must
 * be discarded; a fresh resolution must run.
 */
export function isTripStale(
  trip: { from: string; to: string } | undefined | null,
  state: ConversationalJourneyState
): boolean {
  if (!trip) return false; // nothing to be stale

  const normTripFrom = trip.from.toLowerCase().trim();
  const normStateFrom = (state.originText ?? "").toLowerCase().trim();
  const originMismatch =
    Boolean(normStateFrom) &&
    !placesMatch(normTripFrom, normStateFrom);

  const normTripTo = trip.to.toLowerCase().trim();
  const normStateTo = (state.destinationText ?? "").toLowerCase().trim();
  const destMismatch =
    Boolean(normStateTo) &&
    !placesMatch(normTripTo, normStateTo);

  return Boolean(originMismatch || destMismatch);
}

