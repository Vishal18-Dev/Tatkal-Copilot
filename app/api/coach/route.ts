import { NextResponse } from "next/server";
import OpenAI from "openai";
import { coachFor } from "@/lib/agent";
import type { AgentState, Trip } from "@/types";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ------------------------------------------------------------------
   AI Coach API — takes a user question + journey context and returns
   a contextually grounded response. Falls back to deterministic
   coachFor() if OpenAI is unavailable.
------------------------------------------------------------------ */

interface CoachRequest {
  message: string;
  journeyContext: {
    agentState: AgentState;
    from: string;
    to: string;
    primaryTrain: string;
    primaryClass: string;
    primaryConfidence: string;
    backupTrain: string | null;
    backupConfidence: string | null;
    backupVia: string | null;
    tatkalOpens: string;
    arrivalTarget: string | null;
    passengerCount: number;
    mode: string;
    bookingStatus: string | null;
    recovered: boolean;
    notificationsSent?: { channel: string; title: string; body: string; at: string }[];
    readiness?: {
      readyCount: number;
      totalCount: number;
      summary: string;
      blocking: string[];
      missing: string[];
      checks?: { id: string; label: string; status: string; reason: string; category: string }[];
    };
  };
}

export async function POST(req: Request) {
  let body: CoachRequest;
  try {
    body = (await req.json()) as CoachRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, journeyContext } = body;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  // 1. Try OpenAI if key is present
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey });
      const contextStr = JSON.stringify(journeyContext, null, 2);

      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: `You are the AI Coach inside Tatkal Copilot, an Indian railway Tatkal ticket booking assistant. You speak warmly and clearly to Manoj, a 54-year-old traveller. 

Your responses must be:
- Grounded ONLY in the journey context provided below. Never invent train names, times, prices, or probabilities.
- 2-4 sentences maximum. Plain, reassuring language.
- Never mention raw percentages — use confidence words only: Very High, High, Medium, Low.
- Never claim real IRCTC integration. This is a demo/prototype.

CRITICAL AUTHORIZATION MODE RULES:
- If mode = "assisted":
  * Before window open: "I'll watch the clock and make sure you're there when Tatkal opens."
  * At window open: "The window is open. Your plan is ready. Tap Start booking when you're ready."
  * Primary failure: "Your primary train is unavailable. Your backup is ready. Tap Use backup when you're ready."
  * NEVER say "I've started booking" unless user initiated booking.
- If mode = "auto" or "permissioned":
  * Before window open: "I'll start the prepared booking strategy when Tatkal opens."
  * At window open: "The window is open. I'm starting your prepared booking strategy now."
  * Primary failure: "Your primary strategy is unavailable. I'm evaluating your backup."
  * Backup activation: "Your primary option failed. I've switched to your prepared backup strategy."
  * NEVER say "Tap Start booking" in Permissioned mode.

Current journey context:
${contextStr}`,
          },
          { role: "user", content: message },
        ],
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        return NextResponse.json({ response, source: "gpt" });
      }
    } catch (err) {
      console.warn("[api/coach] GPT failed, checking Gemini fallback:", err);
    }
  }

  // 2. Try Gemini fallback if OpenAI failed or key is absent
  const geminiResponse = await callGeminiCoach(message, journeyContext);
  if (geminiResponse) {
    return NextResponse.json({ response: geminiResponse, source: "gemini" });
  }

  // 3. Graceful degradation — return deterministic coach
  return NextResponse.json({
    response: coachFor(
      journeyContext?.agentState ?? "scheduled",
      buildMinimalTrip(journeyContext)
    ),
    source: "local",
  });
}

/** Fallback AI coach via Google Gemini REST API. */
async function callGeminiCoach(message: string, context: CoachRequest["journeyContext"]) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const prompt = `You are the AI Coach inside Tatkal Copilot, an Indian railway Tatkal ticket booking assistant. Speak warmly, clearly, and concisely (2-3 sentences).

CRITICAL AUTHORIZATION MODE RULES:
- If mode = "assisted":
  * Before window open: "I'll watch the clock and make sure you're there when Tatkal opens."
  * At window open: "The window is open. Your plan is ready. Tap Start booking when you're ready."
  * Primary failure: "Your primary train is unavailable. Your backup is ready. Tap Use backup when you're ready."
  * NEVER say "I've started booking" unless user initiated booking.
- If mode = "auto" or "permissioned":
  * Before window open: "I'll start the prepared booking strategy when Tatkal opens."
  * At window open: "The window is open. I'm starting your prepared booking strategy now."
  * Primary failure: "Your primary strategy is unavailable. I'm evaluating your backup."
  * Backup activation: "Your primary option failed. I've switched to your prepared backup strategy."
  * NEVER say "Tap Start booking" in Permissioned mode.

Current journey context:
${JSON.stringify(context, null, 2)}

User question: "${message}"`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1500 },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.warn("[api/coach] Gemini call failed:", err);
    return null;
  }
}

/** Build a minimal Trip-like object for the deterministic coachFor(). */
function buildMinimalTrip(ctx: CoachRequest["journeyContext"]): Trip {
  return {
    id: "",
    status: "upcoming",
    from: ctx?.from ?? "Mumbai",
    to: ctx?.to ?? "Delhi",
    fromCode: "",
    toCode: "",
    dateLabel: "Tomorrow",
    trainName: ctx?.primaryTrain ?? "",
    travelClass: (ctx?.primaryClass as Trip["travelClass"]) ?? "3A",
    travellerIds: [],
    boardingStationName: "",
    arrivalDisplay: "",
    fare: 0,
    mode: (ctx?.mode as Trip["mode"]) ?? "assisted",
    agentState: ctx?.agentState ?? "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: ctx?.tatkalOpens ?? "10:00 AM",
    primary: {
      optionId: "",
      trainName: ctx?.primaryTrain ?? "",
      travelClass: (ctx?.primaryClass as Trip["travelClass"]) ?? "3A",
      boardingStationName: "",
      departureDisplay: "",
      arrivalDisplay: "",
      level: (ctx?.primaryConfidence as Trip["primary"]["level"]) ?? "High",
      fare: 0,
    },
    backup: ctx?.backupTrain
      ? {
          optionId: "",
          trainName: ctx.backupTrain,
          travelClass: "3A",
          boardingStationName: "",
          departureDisplay: "",
          arrivalDisplay: "",
          level: (ctx?.backupConfidence as Trip["primary"]["level"]) ?? "Very High",
          fare: 0,
          via: ctx.backupVia ?? undefined,
        }
      : null,
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    booking: ctx?.bookingStatus
      ? {
          status: ctx.bookingStatus as Trip["booking"] extends undefined ? never : NonNullable<Trip["booking"]>["status"],
          recovered: ctx.recovered ?? false,
          primaryTrainName: ctx.primaryTrain,
          finalTrainName: ctx.recovered ? (ctx.backupTrain ?? ctx.primaryTrain) : ctx.primaryTrain,
        }
      : undefined,
  } as Trip;
}
