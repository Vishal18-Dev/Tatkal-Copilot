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
  /** Pending clarification field requested by Copilot ("origin" | "destination"). */
  pendingClarification?: "origin" | "destination";
  /**
   * Opaque fingerprint of the material constraints.
   *
   * Changes whenever origin, destination, travelDate, timeConstraint,
   * passengerCount, travelClass, boardingStationPreference, excludeStationCode,
   * or priority change.
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
    String(state.passengerCount ?? 1),
    (state.travelClass ?? "").toLowerCase().trim(),
    (state.boardingStationPreference ?? "").toLowerCase().trim(),
    (state.excludeStationCode ?? state.excludeStationText ?? "").toLowerCase().trim(),
    (state.priority ?? "").toLowerCase().trim(),
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
    passengerCount: trip.travellerIds?.length ?? 1,
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

// Passenger count
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
  pendingClarification?: "origin" | "destination"
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

  // ── Pending clarification contextual resolution ───────────────────
  // When Copilot explicitly asked "Where are you starting from?" or "Where would you like to travel?",
  // interpret short standalone utterances relative to that pending question.
  if (pendingClarification === "origin") {
    const isExplicitToVerb = /\b(?:to|reach|go\s+to|tickets?\s+to)\s+[a-zA-Z]/i.test(text);
    if (!isExplicitToVerb) {
      const cleaned = text.replace(/^[,\s\.]*|[,\s\.]*$/g, "").trim();
      const stripped = cleaned.replace(/^(?:from|starting\s+from|start\s+from|i'm\s+in|i\s+am\s+in|in|at|living\s+in|live\s+in)\s+/i, "").trim();
      const ignorableWords = ["the", "a", "an", "yes", "no", "ok", "sure", "cancel", "stop"];
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
      const ignorableWords = ["the", "a", "an", "yes", "no", "ok", "sure", "cancel", "stop"];
      if (stripped && !ignorableWords.includes(stripped.toLowerCase())) {
        destinationText = stripped;
        correctedFields.push("destination");
      }
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

  // ── Boarding preference (check before residential so "board from X" wins)
  const boardM = text.match(BOARD_FROM_RE);
  if (boardM) {
    boardingStationPreference = boardM[1].trim();
    correctedFields.push("boardingStationPreference");
  }

  // ── Residential context ("I live in Pune", "I'm in Pune")
  const resM = text.match(I_LIVE_IN_RE) ?? text.match(RESIDENT_OF_RE);
  if (resM) {
    residentOf = resM[1].trim();
    if (!correctedFields.includes("residentOf")) correctedFields.push("residentOf");
  }

  // ── Explicit "from X to Y" or "to Y from X" patterns
  const fromToM = text.match(
    /(?:from|starting\s+from|start\s+from)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:to|reach|for)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at)|\.|,|$)/i
  );
  if (fromToM) {
    originText = fromToM[1].trim();
    destinationText = fromToM[2].trim();
    if (!correctedFields.includes("origin")) correctedFields.push("origin");
    if (!correctedFields.includes("destination")) correctedFields.push("destination");
  }

  if (!originText || !destinationText) {
    const toFromM = text.match(
      /(?:to|reach|go\s+to)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:from|starting\s+from)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at)|\.|,|$)/i
    );
    if (toFromM) {
      destinationText = toFromM[1].trim();
      originText = toFromM[2].trim();
      if (!correctedFields.includes("origin")) correctedFields.push("origin");
      if (!correctedFields.includes("destination")) correctedFields.push("destination");
    }
  }

  if (!originText || !destinationText) {
    const inReachM = text.match(
      /(?:i'm\s+at|i\s+am\s+at|i'm\s+in|i\s+am\s+in|in|at|live\s+in)\s+([a-zA-Z][a-zA-Z\s]+?)\s+(?:and\s+need\s+to\s+reach|and\s+want\s+to\s+go\s+to|and\s+going\s+to|need\s+to\s+reach|going\s+to|and\s+i\s+want\s+to\s+go\s+to|i\s+want\s+to\s+go\s+to|want)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at|instead|though)|\.|,|$)/i
    );
    if (inReachM) {
      originText = inReachM[1].trim();
      destinationText = inReachM[2].trim();
      if (!correctedFields.includes("origin")) correctedFields.push("origin");
      if (!correctedFields.includes("destination")) correctedFields.push("destination");
    }
  }

  // ── Destination-only verb ("go to Delhi", "take me to Delhi", "want Delhi", etc.)
  // Skip if text is expressing negative station preference or pending clarification was origin (unless explicit correction)
  if (!destinationText && !excludeStationText && (pendingClarification !== "origin" || isCorrection)) {
    const toOnlyM = text.match(
      /(?:take\s+me\s+to|travel\s+to|tickets?\s+to|going\s+to|go\s+to|reach|want\s+to\s+go\s+to|i\s+want\s+to\s+go\s+to|i\s+need\s+to\s+go\s+to|i\s+want|\bto\b|\btowards\b)\s+([a-zA-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|kal|by|before|in|at|instead|though|and|from|with|for|as)|\.|,|$)/i
    );
    if (toOnlyM && !["the", "a", "an"].includes(toOnlyM[1].trim().toLowerCase())) {
      destinationText = toOnlyM[1].trim();
      if (!correctedFields.includes("destination"))
        correctedFields.push("destination");
    }
  }

  // ── Standalone origin ("from Mumbai", "starting from Chennai", "I'm travelling from Mumbai")
  if (!originText && !boardingStationPreference && !excludeStationText && (pendingClarification !== "destination" || isCorrection)) {
    const originCorrM = text.match(
      /(?:from|starting\s+from|start\s+from)\s+([A-Za-z][a-z\s]+?)(?:\s|,|\.|$)/i
    );
    if (originCorrM && !fromToM) {
      originText = originCorrM[1].trim();
      if (!correctedFields.includes("origin")) correctedFields.push("origin");
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
  const paxM = text.match(PAX_RE);
  if (paxM) {
    passengerCount = parseInt(paxM[1], 10);
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

  return {
    originText,
    destinationText,
    residentOf,
    boardingStationPreference,
    excludeStationCode,
    excludeStationText,
    priority,
    travelDate,
    timeConstraint,
    passengerCount,
    travelClass,
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
  }

  // 10. Travel class
  if (extracted.travelClass && extracted.travelClass !== existing.travelClass) {
    next.travelClass = extracted.travelClass;
    changedFields.push("travelClass");
  }

  // Recompute resolutionId
  const newId = computeResolutionId(next);
  const materialChange = newId !== existing.resolutionId;
  next.resolutionId = newId;

  return { state: next, materialChange, changedFields };
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
    !normTripFrom.includes(normStateFrom) &&
    !normStateFrom.includes(normTripFrom);

  const normTripTo = trip.to.toLowerCase().trim();
  const normStateTo = (state.destinationText ?? "").toLowerCase().trim();
  const destMismatch =
    Boolean(normStateTo) &&
    !normTripTo.includes(normStateTo) &&
    !normStateTo.includes(normTripTo);

  return Boolean(originMismatch || destMismatch);
}
