import { NextResponse } from "next/server";
import OpenAI from "openai";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import type { Plan, TravelIntent } from "@/types";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ------------------------------------------------------------------
   The AI does the two things it is genuinely good at:
   1. Turn Manoj's messy sentence into structured intent.
   2. Explain the strategy like a seasoned travel agent.
   The STRATEGY and every NUMBER stay grounded in mock data via the
   local planner, so GPT can never invent a fake confirmation figure.
------------------------------------------------------------------ */

export async function POST(req: Request) {
  const { goal } = (await req.json().catch(() => ({}))) as { goal?: string };
  if (!goal || typeof goal !== "string") {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  // No key configured → deterministic local plan (still excellent).
  if (!apiKey) {
    return NextResponse.json(buildPlanLocally(parseIntentLocally(goal)));
  }

  const client = new OpenAI({ apiKey });

  try {
    // 1. GPT intent extraction (grounded fields, local parse as backstop).
    const intent = await extractIntent(client, goal);

    // 2. Build the grounded plan from that intent.
    const plan = buildPlanLocally(intent);

    // 3. GPT rewrites the recommendation rationale as a travel agent.
    const whyRecommended = await writeWhyRecommended(client, plan);

    const enriched: Plan = {
      ...plan,
      narrative: { whyRecommended },
      source: "gpt",
    };
    return NextResponse.json(enriched);
  } catch (err) {
    console.warn("[api/plan] GPT path failed, using local planner:", err);
    return NextResponse.json(buildPlanLocally(parseIntentLocally(goal)));
  }
}

async function extractIntent(
  client: OpenAI,
  goal: string
): Promise<TravelIntent> {
  const local = parseIntentLocally(goal);
  const knownDestinations = "Delhi (NDLS), Bengaluru (SBC), Chennai (MAS)";

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract structured train-travel intent from a single sentence by an Indian passenger booking a Tatkal ticket. Return ONLY JSON. The origin defaults to Mumbai unless clearly stated. Known destinations: " +
          knownDestinations +
          ". Fields: to (city name), toCode (station code), arrivalDeadline (HH:MM 24h or null), passengers (integer 1-6), preferredClass (one of 1A,2A,3A,SL,CC,EC, or 'any'), priority (one of 'arrival-time','cheapest','comfort','safest'), flexibility (0-1 float; higher if the user is open to alternate boarding or timing), restated (one warm plain-language sentence restating the goal).",
      },
      { role: "user", content: goal },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<TravelIntent>;
  try {
    parsed = JSON.parse(raw) as Partial<TravelIntent>;
  } catch {
    console.warn("[api/plan] Malformed intent JSON from GPT, using local");
    return local;
  }

  // Merge GPT output over the local parse; local fills any gaps.
  return {
    from: local.from,
    fromCode: local.fromCode,
    to: parsed.to ?? local.to,
    toCode: parsed.toCode ?? local.toCode,
    date: local.date,
    arrivalDeadline:
      parsed.arrivalDeadline === undefined
        ? local.arrivalDeadline
        : parsed.arrivalDeadline,
    passengers: clampInt(parsed.passengers, 1, 6, local.passengers),
    preferredClass: parsed.preferredClass ?? local.preferredClass,
    priority: parsed.priority ?? local.priority,
    flexibility:
      typeof parsed.flexibility === "number"
        ? Math.max(0, Math.min(1, parsed.flexibility))
        : local.flexibility,
    restated: parsed.restated ?? local.restated,
  };
}

async function writeWhyRecommended(
  client: OpenAI,
  plan: Plan
): Promise<string> {
  const rec = plan.options.find((o) => o.id === plan.recommendedId)!;
  const facts = {
    goal: plan.intent.restated,
    deadline: plan.intent.arrivalDeadline,
    recommended: {
      train: rec.title,
      class: rec.travelClass,
      confidence: rec.level,
      arrival: rec.arrivalDisplay,
      boardAt: rec.boardingStationName,
    },
    alternatives: plan.options
      .filter((o) => o.id !== rec.id)
      .map((o) => ({
        name: o.title,
        confidence: o.level,
        note: o.tagLabel,
        arrivesAfterDeadline: plan.intent.arrivalDeadline ? !o.meetsDeadline : false,
      })),
  };

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a warm, sharp Indian Tatkal travel agent speaking to Manoj, 54, not tech-savvy. Given grounded facts, return ONLY JSON {\"whyRecommended\": string}. 2-3 short sentences, plain reassuring language, no jargon. Explain why the recommended option is the best fit for the goal versus the alternatives (touch on the deadline and demand). NEVER output any percentages or invented numbers — describe confidence only with the given words (Very High / High / Medium / Low). Address Manoj directly.",
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let n: { whyRecommended?: string };
  try {
    n = JSON.parse(raw) as { whyRecommended?: string };
  } catch {
    console.warn("[api/plan] Malformed narrative JSON from GPT");
    return plan.narrative.whyRecommended;
  }
  return n.whyRecommended || plan.narrative.whyRecommended;
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
