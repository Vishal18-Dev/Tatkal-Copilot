import {
  trains,
  splitRoutes,
  resolveStation,
  stationByCode,
} from "@/lib/data";
import { arrivesBefore, formatArrival, formatDuration } from "@/lib/utils";
import type {
  Plan,
  Train,
  TravelClass,
  TravelIntent,
  ClassAvailability,
  StrategyOption,
  OptionTag,
  ConfidenceLevel,
} from "@/types";

/* ============================================================
   1. Local intent parser (fallback for GPT extraction)
   Turns Manoj's sentence into structured intent.
   ============================================================ */

const CITY_HINTS: Record<string, string> = {
  delhi: "NDLS",
  "new delhi": "NDLS",
  bengaluru: "SBC",
  bangalore: "SBC",
  chennai: "MAS",
  mumbai: "BCT",
};

function parseArrivalDeadline(text: string): string | null {
  const m = text.match(
    /(?:before|by|reach.*?(?:before|by)?|arrive.*?(?:before|by)?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parsePassengers(text: string): number {
  const t = text.toLowerCase();
  const numMatch = t.match(/(\d+)\s*(?:tickets?|seats?|people|passengers?|of us)/);
  if (numMatch) return Math.min(6, Math.max(1, parseInt(numMatch[1], 10)));
  let count = 1;
  if (/\bwife|husband|spouse|partner\b/.test(t)) count += 1;
  if (/\bparents\b/.test(t)) count = Math.max(count, 3);
  if (/\bwith (?:my )?family\b/.test(t)) count = Math.max(count, 4);
  if (/\balone|just me|myself\b/.test(t)) count = 1;
  const kids = t.match(/(\d+)\s*(?:kids?|children|child)/);
  if (kids) count += parseInt(kids[1], 10);
  return Math.min(6, count);
}

function parseClass(text: string): TravelClass | "any" {
  const t = text.toLowerCase();
  if (/\b1a|first class|first ac\b/.test(t)) return "1A";
  if (/\b2a|second ac|2 tier\b/.test(t)) return "2A";
  if (/\b3a|third ac|3 tier\b/.test(t)) return "3A";
  if (/\bsleeper|sl\b/.test(t)) return "SL";
  if (/\bac\b/.test(t)) return "3A";
  return "any";
}

function parsePriority(text: string): TravelIntent["priority"] {
  const t = text.toLowerCase();
  if (/cheap|budget|lowest|affordable|save money/.test(t)) return "cheapest";
  if (/comfort|comfortable|first class|1a|luxur|lower berth/.test(t))
    return "comfort";
  if (/before|by \d|reach|arrive|morning|deadline|meeting/.test(t))
    return "arrival-time";
  return "safest";
}

function parseFlexibility(text: string): number {
  const t = text.toLowerCase();
  let f = 0.6;
  if (/flexible|any train|any time|whatever works|open to/.test(t)) f = 0.85;
  if (/must|exactly|only|strictly|has to be/.test(t)) f -= 0.25;
  return Math.max(0.2, Math.min(0.95, f));
}

export function parseIntentLocally(goal: string): TravelIntent {
  const text = goal.trim();
  const lower = text.toLowerCase();

  let toCode = "NDLS";
  for (const [k, code] of Object.entries(CITY_HINTS)) {
    if (k === "mumbai") continue;
    if (lower.includes(k)) {
      toCode = code;
      break;
    }
  }
  let fromCode = "BCT";
  const fromMatch = lower.match(/from\s+([a-z\s]+?)(?:\s+to|\s+before|\s+by|$)/);
  if (fromMatch) {
    const s = resolveStation(fromMatch[1]);
    if (s) fromCode = s.code;
  }

  const from = stationByCode(fromCode)!;
  const to = stationByCode(toCode)!;
  const passengers = parsePassengers(text);
  const preferredClass = parseClass(text);
  const priority = parsePriority(text);
  const deadline = parseArrivalDeadline(text);

  return {
    from: from.city,
    fromCode,
    to: to.city,
    toCode,
    date: new Date().toISOString().slice(0, 10),
    arrivalDeadline: deadline,
    passengers,
    preferredClass,
    priority,
    flexibility: parseFlexibility(text),
    restated: buildRestatement({
      to: to.city,
      passengers,
      priority,
      preferredClass,
      deadline,
    }),
  };
}

function buildRestatement(p: {
  to: string;
  passengers: number;
  priority: TravelIntent["priority"];
  preferredClass: TravelClass | "any";
  deadline: string | null;
}): string {
  const who = p.passengers === 1 ? "you" : `${p.passengers} travellers`;
  const cls = p.preferredClass === "any" ? "" : ` in ${p.preferredClass}`;
  const when = p.deadline ? ` before ${p.deadline}` : "";
  const goalWord =
    p.priority === "cheapest"
      ? "the cheapest confirmed way"
      : p.priority === "comfort"
      ? "the most comfortable confirmed berth"
      : "the highest chance of a confirmed berth";
  return `Get ${who}${cls} to ${p.to}${when} — optimising for ${goalWord}.`;
}

/* ============================================================
   2. Option + plan builder
   ============================================================ */

const cityCodes: Record<string, string[]> = {
  Mumbai: ["BCT", "BDTS", "DR", "BVI", "BSR"],
  Delhi: ["NDLS", "NZM", "DLI"],
  Bengaluru: ["SBC"],
  Chennai: ["MAS"],
};

function trainsForCorridor(fromCity: string, toCity: string): Train[] {
  const froms = cityCodes[fromCity] ?? [];
  const tos = cityCodes[toCity] ?? [];
  return trains.filter(
    (t) => froms.includes(t.fromCode) && tos.includes(t.toCode)
  );
}

/** Public wrapper for the TrainProvider abstraction. */
export function trainsForCorridorPublic(
  fromCity: string,
  toCity: string
): Train[] {
  return trainsForCorridor(fromCity, toCity);
}

function pickClass(train: Train, intent: TravelIntent): ClassAvailability {
  const cls = train.classes;
  if (intent.preferredClass !== "any") {
    const exact = cls.find((c) => c.travelClass === intent.preferredClass);
    if (exact) return exact;
  }
  if (intent.priority === "cheapest") {
    return [...cls].sort((a, b) => a.fare - b.fare)[0];
  }
  if (intent.priority === "comfort") {
    const order: TravelClass[] = ["2A", "1A", "3A", "EC", "CC", "SL"];
    return (
      order.map((o) => cls.find((c) => c.travelClass === o)).find(Boolean) ??
      cls[0]
    );
  }
  const threeA = cls.find((c) => c.travelClass === "3A");
  if (threeA) return threeA;
  return [...cls].sort((a, b) => b.confirmProbability - a.confirmProbability)[0];
}

function scoreTrain(train: Train, intent: TravelIntent): number {
  const c = pickClass(train, intent);
  let score = c.confirmProbability;
  score -= train.competition * 0.15;
  const meets = arrivesBefore(train.arrival, train.arrivalDayOffset, intent.arrivalDeadline);
  if (intent.arrivalDeadline) score += meets ? 22 : -40;
  if (intent.priority === "cheapest") score += Math.max(0, 40 - c.fare / 60);
  if (intent.priority === "comfort" && (c.travelClass === "2A" || c.travelClass === "1A"))
    score += 15;
  return score;
}

function starsFor(chance: number): number {
  if (chance >= 80) return 5;
  if (chance >= 60) return 4;
  if (chance >= 45) return 3;
  if (chance >= 25) return 2;
  return 1;
}

function levelFor(chance: number): ConfidenceLevel {
  if (chance >= 80) return "Very High";
  if (chance >= 58) return "High";
  if (chance >= 42) return "Medium";
  return "Low";
}

function buildDirectOption(
  train: Train,
  intent: TravelIntent
): StrategyOption {
  const cls = pickClass(train, intent);
  const origin = stationByCode(train.fromCode)!;
  const useAlt =
    intent.flexibility >= 0.4 && (train.alternateBoarding?.length ?? 0) > 0;
  const alt = useAlt
    ? [...train.alternateBoarding!].sort((a, b) => b.confirmUplift - a.confirmUplift)[0]
    : null;
  const meets = arrivesBefore(train.arrival, train.arrivalDayOffset, intent.arrivalDeadline);

  const risks: string[] = [];
  if (train.competition >= 85)
    risks.push("Extreme demand — the quota can vanish within seconds of opening.");
  else if (train.competition >= 70)
    risks.push("High demand — expect the quota to move fast.");
  if (intent.arrivalDeadline && !meets)
    risks.push(`Arrives ${formatArrival(train.arrival, train.arrivalDayOffset)} — after your ${intent.arrivalDeadline} target.`);
  if (cls.confirmProbability < 40)
    risks.push("Lower historical confirmation than your recommended option.");

  const tradeoffs: string[] = [];
  if (intent.arrivalDeadline && meets)
    tradeoffs.push(`Comfortably before your ${intent.arrivalDeadline} deadline.`);
  if (cls.travelClass === "2A" || cls.travelClass === "1A")
    tradeoffs.push("More comfort, fewer seats.");
  if (alt)
    tradeoffs.push(`Board at ${alt.stationName} to add roughly +${alt.confirmUplift} points.`);

  return {
    id: `${train.number}-${cls.travelClass}`,
    kind: "direct",
    title: train.name,
    subtitle: `#${train.number}`,
    travelClass: cls.travelClass,
    stars: starsFor(cls.confirmProbability),
    confirmProbability: cls.confirmProbability,
    level: levelFor(cls.confirmProbability),
    departureDisplay: train.departure,
    arrivalDisplay: formatArrival(train.arrival, train.arrivalDayOffset),
    durationDisplay: formatDuration(train.durationMins),
    fare: cls.fare,
    boardingStationCode: alt ? alt.stationCode : train.fromCode,
    boardingStationName: alt ? alt.stationName : origin.name,
    betterBoarding: !!alt,
    tag: "highest",
    tagLabel: "",
    meetsDeadline: meets,
    why: "",
    risks,
    tradeoffs,
    recommended: false,
    tatkalOpensAt: train.tatkalOpensAt,
    trainNumber: train.number,
  };
}

function buildSplitOption(intent: TravelIntent): StrategyOption | null {
  const corridor = `${intent.fromCode}-${intent.toCode}`;
  const rec =
    splitRoutes.find((s) => s.corridor === corridor) ??
    (intent.fromCode === "BCT" && ["NDLS", "NZM", "DLI"].includes(intent.toCode)
      ? splitRoutes.find((s) => s.corridor === "BCT-NDLS")
      : undefined);
  if (!rec) return null;

  const last = rec.legs[rec.legs.length - 1];
  const meets = arrivesBefore(last.arrival, 1, intent.arrivalDeadline);
  const origin = stationByCode(rec.legs[0].fromCode)!;

  const risks: string[] = ["Two separate bookings to hold and manage."];
  if (intent.arrivalDeadline && !meets)
    risks.push(`Arrives ${last.arrival} — after your ${intent.arrivalDeadline} target.`);

  return {
    id: `split-${rec.viaCode}`,
    kind: "split",
    title: `Split via ${rec.viaName}`,
    subtitle: `${origin.city} → ${rec.viaName} → ${stationByCode(intent.toCode)!.city}`,
    travelClass: "3A",
    stars: starsFor(rec.combinedConfirmProbability),
    confirmProbability: rec.combinedConfirmProbability,
    level: levelFor(rec.combinedConfirmProbability),
    departureDisplay: rec.legs[0].departure,
    arrivalDisplay: `${last.arrival} · tomorrow`,
    durationDisplay: "2 legs",
    fare: rec.fare ?? 2540,
    boardingStationCode: rec.legs[0].fromCode,
    boardingStationName: origin.name,
    betterBoarding: false,
    tag: "highest",
    tagLabel: "",
    meetsDeadline: meets,
    why: "",
    risks,
    tradeoffs: ["Highest confirmation of every option.", "Longer overall trip."],
    recommended: false,
    tatkalOpensAt: "10:00",
    legs: rec.legs.map((l) => ({
      fromCode: l.fromCode,
      toCode: l.toCode,
      trainName: l.trainName,
      departure: l.departure,
      arrival: l.arrival,
      confirmProbability: l.confirmProbability,
    })),
  };
}

const TAG_LABELS: Record<OptionTag, string> = {
  recommended: "Recommended",
  highest: "Highest chance",
  cheapest: "Cheapest",
  fastest: "Earliest arrival",
  popular: "Most in-demand",
};

/** Assign each option one earned superlative tag. */
function assignTags(options: StrategyOption[], recommendedId: string) {
  const usedTags = new Set<OptionTag>();
  const taggedIds = new Set<string>();

  const rec = options.find((o) => o.id === recommendedId)!;
  rec.tag = "recommended";
  rec.tagLabel = TAG_LABELS.recommended;
  usedTags.add("recommended");
  taggedIds.add(rec.id);

  const pool = options.filter((o) => o.id !== recommendedId);

  const assign = (o: StrategyOption | undefined, tag: OptionTag) => {
    if (o && !usedTags.has(tag) && !taggedIds.has(o.id)) {
      o.tag = tag;
      o.tagLabel = TAG_LABELS[tag];
      usedTags.add(tag);
      taggedIds.add(o.id);
    }
  };

  assign([...pool].sort((a, b) => b.confirmProbability - a.confirmProbability)[0], "highest");
  assign([...pool].sort((a, b) => a.fare - b.fare)[0], "cheapest");
  const popular = [...pool]
    .filter((o) => o.kind === "direct")
    .map((o) => ({ o, comp: trains.find((t) => t.number === o.trainNumber)?.competition ?? 0 }))
    .sort((a, b) => b.comp - a.comp)[0]?.o;
  assign(popular, "popular");

  // Anything still untagged → fallback.
  for (const o of pool) {
    if (taggedIds.has(o.id)) continue;
    const tag: OptionTag = !usedTags.has("fastest") ? "fastest" : "highest";
    o.tag = tag;
    o.tagLabel = TAG_LABELS[tag];
    usedTags.add(tag);
    taggedIds.add(o.id);
  }
}

function writeWhy(o: StrategyOption, intent: TravelIntent, isRec: boolean): string {
  if (isRec) {
    return `The best balance of arrival time and confirmation chance. It ${
      intent.arrivalDeadline
        ? `lands ${o.arrivalDisplay}, before your ${intent.arrivalDeadline} deadline`
        : `arrives ${o.arrivalDisplay}`
    }, and sits in a quieter corner of the Tatkal rush than the headline trains — so your confirmation confidence is ${o.level}.`;
  }
  switch (o.tag) {
    case "highest":
      return `The single highest confirmation confidence of every option — strongest if getting a seat matters more than journey time. The trade-off is a longer trip.`;
    case "cheapest":
      return `The lightest on your wallet at ${o.travelClass}, while still keeping a ${o.level} confirmation confidence.`;
    case "popular":
      return `The famous, fastest-feeling option everyone chases — which is exactly why its Tatkal quota is the hardest to catch, leaving confidence ${o.level}.`;
    default:
      return `A reasonable alternative with ${o.level} confirmation confidence.`;
  }
}

export function buildPlanLocally(intent: TravelIntent): Plan {
  let directs = trainsForCorridor(intent.from, intent.to);
  if (directs.length === 0) {
    intent = { ...intent, from: "Mumbai", fromCode: "BCT", to: "Delhi", toCode: "NDLS" };
    directs = trainsForCorridor("Mumbai", "Delhi");
  }

  const recommendedTrain = [...directs].sort(
    (a, b) => scoreTrain(b, intent) - scoreTrain(a, intent)
  )[0];

  const directOptions = directs.map((t) => buildDirectOption(t, intent));
  const recommendedId = `${recommendedTrain.number}-${
    pickClass(recommendedTrain, intent).travelClass
  }`;

  // Curate directs to at most 3 (recommended + cheapest + most-popular + fill).
  const curated: StrategyOption[] = [];
  const rec = directOptions.find((o) => o.id === recommendedId)!;
  curated.push(rec);
  const rest = directOptions.filter((o) => o.id !== recommendedId);
  const cheapest = [...rest].sort((a, b) => a.fare - b.fare)[0];
  const popular = [...rest]
    .map((o) => ({ o, c: trains.find((t) => t.number === o.trainNumber)?.competition ?? 0 }))
    .sort((a, b) => b.c - a.c)[0]?.o;
  for (const o of [cheapest, popular]) if (o && !curated.includes(o)) curated.push(o);
  for (const o of [...rest].sort((a, b) => b.confirmProbability - a.confirmProbability)) {
    if (curated.length >= 3) break;
    if (!curated.includes(o)) curated.push(o);
  }

  const splitOption = buildSplitOption(intent);
  let options = splitOption ? [...curated, splitOption] : [...curated];

  assignTags(options, recommendedId);
  options.forEach((o) => {
    o.recommended = o.id === recommendedId;
    o.why = writeWhy(o, intent, o.recommended);
  });

  // Recommended pinned first, then by confirmation chance desc.
  options = [
    options.find((o) => o.id === recommendedId)!,
    ...options
      .filter((o) => o.id !== recommendedId)
      .sort((a, b) => b.confirmProbability - a.confirmProbability),
  ];

  const recommended = options[0];
  return {
    intent,
    options,
    recommendedId,
    narrative: { whyRecommended: recommended.why },
    source: "local",
  };
}

/** Agent-style pushback when the user picks against the recommendation. */
export function explainDeviation(
  plan: Plan,
  chosenId: string
): { title: string; body: string } | null {
  const rec = plan.options.find((o) => o.id === plan.recommendedId);
  const chosen = plan.options.find((o) => o.id === chosenId);
  if (!rec || !chosen || chosen.id === rec.id) return null;

  const parts: string[] = [];
  if (chosen.tag === "popular") {
    parts.push("it's currently our riskiest recommendation — demand is Very High and its confirmation confidence is Low");
  } else if (chosen.confirmProbability < rec.confirmProbability) {
    parts.push(`its confirmation confidence is ${chosen.level}, below the ${rec.level} of our pick`);
  } else if (chosen.confirmProbability > rec.confirmProbability) {
    parts.push(`its confirmation confidence is higher (${chosen.level})`);
  }
  if (rec.meetsDeadline && !chosen.meetsDeadline && plan.intent.arrivalDeadline) {
    parts.push(
      `and it arrives ${chosen.arrivalDisplay} — after your ${plan.intent.arrivalDeadline} target`
    );
  }
  if (chosen.kind === "split") {
    parts.push("and it means two separate bookings to manage");
  }

  const body =
    parts.length > 0
      ? `${chosen.title} is a valid choice. However, ${parts.join(", ")}. Would you still like to continue?`
      : `${chosen.title} is a valid choice. It trades off differently from our recommendation — continue?`;

  return { title: `Rethinking ${chosen.title}?`, body };
}
