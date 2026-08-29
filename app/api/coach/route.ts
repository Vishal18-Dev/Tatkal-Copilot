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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Graceful degradation — return deterministic coach
    return NextResponse.json({
      response: coachFor(
        journeyContext?.agentState ?? "scheduled",
        buildMinimalTrip(journeyContext)
      ),
      source: "local",
    });
  }

  const client = new OpenAI({ apiKey });

  try {
    const contextStr = JSON.stringify(journeyContext, null, 2);

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are the AI Coach inside Tatkal Copilot, an Indian railway Tatkal ticket booking assistant. You speak warmly and clearly to Manoj, a 54-year-old not very tech-savvy traveller. 

Your responses must be:
- Grounded ONLY in the journey context provided below. Never invent train names, times, prices, or probabilities.
- 2-4 sentences maximum. Plain, reassuring language.
- Never mention raw percentages — use confidence words only: Very High, High, Medium, Low.
- Never claim real IRCTC integration. This is a demo/prototype.
- If the user asks why you emailed or notified them, explain that they were inactive shortly before Tatkal opened or an action was required, referencing the notificationsSent array.
- If the user asks if the ticket is booked, check bookingStatus strictly. Never claim a ticket is confirmed unless bookingStatus is 'success' or 'confirmed'.
- If the user asks something outside your journey context, say so honestly.

Current journey context:
${contextStr}`,
        },
        { role: "user", content: message },
      ],
    });

    const response = completion.choices[0]?.message?.content ?? "I'm not sure how to help with that right now.";
    return NextResponse.json({ response, source: "gpt" });
  } catch (err) {
    console.warn("[api/coach] GPT failed, using local coach:", err);
    return NextResponse.json({
      response: coachFor(
        journeyContext?.agentState ?? "scheduled",
        buildMinimalTrip(journeyContext)
      ),
      source: "local",
    });
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
