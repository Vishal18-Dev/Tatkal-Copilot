import { NextResponse } from "next/server";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";
import type { Plan, TravelIntent } from "@/types";

export const runtime = "nodejs";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/* ------------------------------------------------------------------
   The AI does the two things it is genuinely good at:
   1. Turn Manoj's messy sentence into structured intent.
   2. Explain the strategy like a seasoned travel agent.
   The STRATEGY and every NUMBER stay grounded in mock data via the
   local planner, so the LLM can never invent a fake confirmation figure.
------------------------------------------------------------------ */

export async function POST(req: Request) {
  const { goal } = (await req.json().catch(() => ({}))) as { goal?: string };
  if (!goal || typeof goal !== "string") {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  // No key configured → deterministic local plan (still excellent).
  if (!geminiKey) {
    return NextResponse.json(buildPlanLocally(parseIntentLocally(goal)));
  }

  try {
    // 1. Gemini intent extraction (grounded fields, local parse as backstop).
    const intent = await extractIntent(geminiKey, goal);

    // 2. Build the grounded plan from that intent.
    const plan = buildPlanLocally(intent);

    // 3. Gemini rewrites the recommendation rationale as a travel agent.
    const whyRecommended = await writeWhyRecommended(geminiKey, plan);

    const enriched: Plan = {
      ...plan,
      narrative: { whyRecommended },
      source: "gpt",
    };
    return NextResponse.json(enriched);
  } catch (err) {
    console.warn("[api/plan] Gemini path failed, using local planner:", err);
    return NextResponse.json(buildPlanLocally(parseIntentLocally(goal)));
  }
}

async function callGemini(
  apiKey: string,
  prompt: string,
  maxTokens = 400,
  temperature = 0
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;
  // Strip markdown fences Gemini sometimes adds
  return raw.trim().replace(/^```(?:json)?|```$/g, "").trim();
}

async function extractIntent(
  apiKey: string,
  goal: string
): Promise<TravelIntent> {
  const local = parseIntentLocally(goal);
  const knownDestinations = "Delhi (NDLS), Bengaluru (SBC), Chennai (MAS)";

  const prompt = `You extract structured train-travel intent from a single sentence by an Indian passenger booking a Tatkal ticket. Return ONLY JSON. The origin defaults to Mumbai unless clearly stated. Known destinations: ${knownDestinations}. Fields: to (city name), toCode (station code), arrivalDeadline (HH:MM 24h or null), passengers (integer 1-6), preferredClass (one of 1A,2A,3A,SL,CC,EC, or "any"), priority (one of "arrival-time","cheapest","comfort","safest"), flexibility (0-1 float; higher if the user is open to alternate boarding or timing), restated (one warm plain-language sentence restating the goal).

User sentence: "${goal}"`;

  const raw = await callGemini(apiKey, prompt);
  if (!raw) return local;

  let parsed: Partial<TravelIntent>;
  try {
    parsed = JSON.parse(raw) as Partial<TravelIntent>;
  } catch {
    console.warn("[api/plan] Malformed intent JSON from Gemini, using local");
    return local;
  }

  // Merge Gemini output over the local parse; local fills any gaps.
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
  apiKey: string,
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

  const prompt = `You are a warm, sharp Indian Tatkal travel agent speaking to Manoj, 54, not tech-savvy. Given grounded facts, return ONLY JSON {"whyRecommended": string}. 2-3 short sentences, plain reassuring language, no jargon. Explain why the recommended option is the best fit for the goal versus the alternatives (touch on the deadline and demand). NEVER output any percentages or invented numbers — describe confidence only with the given words (Very High / High / Medium / Low). Address Manoj directly.

Facts: ${JSON.stringify(facts)}`;

  const raw = await callGemini(apiKey, prompt, 300, 0.5);
  if (!raw) return plan.narrative.whyRecommended;

  let n: { whyRecommended?: string };
  try {
    n = JSON.parse(raw) as { whyRecommended?: string };
  } catch {
    console.warn("[api/plan] Malformed narrative JSON from Gemini");
    return plan.narrative.whyRecommended;
  }
  return n.whyRecommended || plan.narrative.whyRecommended;
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback?: number
): number | undefined {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
