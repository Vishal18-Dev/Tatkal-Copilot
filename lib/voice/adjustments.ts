import type { Plan, StrategyOption, TravelClass, TravelIntent } from "@/types";
import type { Lang } from "@/lib/i18n";
import { parseVoiceCommand } from "./commands";

/**
 * The turn-taking brain of the voice conversation. Once a recommendation is
 * on screen, a follow-up utterance is one of:
 *   - a COMMAND     (yes / no / repeat / cancel — handled by commands.ts)
 *   - an ADJUSTMENT (only "cheaper" — see below) → recompose a clean goal
 *     string and RE-RUN the existing planner
 *   - a QUESTION / anything else → answer from the grounded plan data already
 *     on the client, never inventing anything
 *
 * Why only "cheaper" is an adjustment: the frozen planner ranks its single
 * recommendation by confirmation confidence, so "faster" / "best chance" /
 * a class switch don't actually change which train it recommends — only the
 * cheapest preference genuinely diverges (verified against the live planner).
 * Offering chips that produce no visible change would look broken, so we only
 * surface an adjustment that really re-ranks, and turn everything else into a
 * grounded spoken answer.
 */

export type AdjustmentKind = "cheaper";

export interface FollowUp {
  kind: "adjust" | "question";
  adjustment?: AdjustmentKind;
  raw: string;
}

const CHEAPER_WORDS = [
  "cheaper",
  "cheapest",
  "budget",
  "lowest fare",
  "less expensive",
  "cheap",
  "sasta",
  "kam paisa",
  "kam kiraya",
  "सस्ता",
  "कम किराया",
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"“”’]/g, "").replace(/\s+/g, " ");
}

export function parseFollowUp(text: string): FollowUp {
  const cmd = parseVoiceCommand(text);
  if (cmd.intent === "cheaper" || cmd.kind === "cheaper") {
    return { kind: "adjust", adjustment: "cheaper", raw: text };
  }
  const norm = normalize(text);
  if (norm && CHEAPER_WORDS.some((w) => norm.includes(w))) {
    return { kind: "adjust", adjustment: "cheaper", raw: text };
  }
  // Everything else that isn't a command becomes a grounded answer — a
  // friendlier default than silence, and it can never book anything.
  return { kind: "question", raw: text };
}

/**
 * Recompose a clean, unambiguous goal string from the current grounded intent
 * plus the cheaper adjustment. Rebuilding from scratch (rather than appending
 * to the raw utterance) avoids the planner seeing conflicting clauses. The
 * planner re-parses this string exactly as it would a typed goal, so the
 * choice carries through to /app/plan identically.
 */
export function composeGoal(intent: TravelIntent, adjustment?: AdjustmentKind): string {
  const travelClass: TravelClass | "any" = intent.preferredClass;
  const passengers = intent.passengers;
  const pref =
    adjustment === "cheaper" ? "the cheapest confirmed option" : priorityPhrase(intent.priority);

  const who = passengers > 1 ? "passengers" : "passenger";
  const classClause = travelClass === "any" ? "" : ` in ${travelClass}`;
  const deadline = intent.arrivalDeadline ? ` reaching before ${intent.arrivalDeadline}` : "";
  return `from ${intent.from} to ${intent.to}, ${passengers} ${who}${classClause}${deadline}, ${pref}`;
}

function priorityPhrase(priority: TravelIntent["priority"]): string {
  if (priority === "cheapest") return "the cheapest confirmed option";
  if (priority === "arrival-time") return "reach as early as possible";
  return "the best chance of a confirmed seat";
}

/**
 * Compose a short, grounded spoken answer to a question — entirely from plan
 * data already on the client. Never invents trains, fares or probabilities.
 */
export function composeAnswer(
  plan: Plan,
  recommended: StrategyOption,
  question: string,
  lang: Lang
): string {
  const q = normalize(question);
  const level = recommended.level;
  const hi = lang === "hi";

  // "what if it fails / doesn't confirm / backup"
  if (/(fail|doesn'?t|does not|backup|back up|nahi|फेल|बैकअप)/.test(q)) {
    const others = plan.options.filter((o) => o.id !== recommended.id);
    const backup = [...others].sort((a, b) => b.confirmProbability - a.confirmProbability)[0];
    if (backup) {
      return hi
        ? `अगर ${recommended.title} कन्फर्म नहीं होती, तो ${backup.title} बैकअप के तौर पर तैयार है।`
        : `If ${recommended.title} doesn't confirm, ${backup.title} is ready as your backup.`;
    }
    return hi
      ? `${recommended.title} पर आपका भरोसा ${levelHi(level)} है।`
      : `Your confidence on ${recommended.title} is ${level}.`;
  }

  // "is it confirmed / what are the chances / sure"
  if (/(confirm|chance|sure|likely|pakka|भरोसा|पक्का)/.test(q)) {
    return hi
      ? `इसकी कन्फर्मेशन की संभावना ${levelHi(level)} है।`
      : `Its confirmation confidence is ${level}.`;
  }

  // "how much / fare / price"
  if (/(fare|price|cost|how much|kitna|kiraya|किराया|कीमत)/.test(q)) {
    return hi
      ? `${recommended.title} का किराया ₹${recommended.fare.toLocaleString("en-IN")} प्रति व्यक्ति है।`
      : `${recommended.title} is ₹${recommended.fare.toLocaleString("en-IN")} per person.`;
  }

  // "why this train / recommend"
  if (/(why|kyun|kyu|क्यों|recommend|suggest)/.test(q)) {
    return plan.narrative.whyRecommended;
  }

  // Fallback — a grounded one-line summary of the current pick.
  return hi
    ? `मेरा सुझाव है ${recommended.title}, ${recommended.travelClass} में, पहुँचता है ${recommended.arrivalDisplay}, भरोसा ${levelHi(level)}।`
    : `I'd suggest ${recommended.title} in ${recommended.travelClass}, arriving ${recommended.arrivalDisplay}, with ${level} confidence.`;
}

function levelHi(level: string): string {
  const map: Record<string, string> = {
    "Very High": "बहुत ऊँचा",
    High: "ऊँचा",
    Medium: "मध्यम",
    Low: "कम",
  };
  return map[level] ?? level;
}

/**
 * The single adjustment chip we surface — and only when a strictly cheaper
 * real option actually exists than the current pick, so it never appears as a
 * dead end.
 */
export function suggestedAdjustments(plan: Plan, recommended: StrategyOption): AdjustmentKind[] {
  const cheaper = plan.options.some((o) => o.fare < recommended.fare);
  return cheaper ? ["cheaper"] : [];
}

export function adjustmentLabel(adjustment: AdjustmentKind, lang: Lang): string {
  if (adjustment === "cheaper") return lang === "hi" ? "कुछ सस्ता" : "Something cheaper";
  return adjustment;
}

/** Grounded question chips offered alongside the recommendation. */
export function suggestedQuestions(lang: Lang): { key: string; label: string }[] {
  return lang === "hi"
    ? [
        { key: "why", label: "यह ट्रेन क्यों?" },
        { key: "backup", label: "अगर कन्फर्म न हो तो?" },
      ]
    : [
        { key: "why", label: "Why this train?" },
        { key: "backup", label: "What if it doesn't confirm?" },
      ];
}
