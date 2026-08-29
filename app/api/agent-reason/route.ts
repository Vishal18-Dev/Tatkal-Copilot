import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { AllowedAgentAction, AllowedAgentTool } from "@/lib/action-validator";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ------------------------------------------------------------------
   Agent Decision API (v1.4 Genuine Agent Decision Loop)

   The client sends environmental & journey OBSERVATIONS ONLY.
   OpenAI evaluates the observation and DECIDES the action and tool call.

   Allowed actions:
     - "none"
     - "notify_user"
     - "open_booking_flow"
     - "evaluate_backup"
     - "activate_backup"

   Returns:
     {
       "action": "...",
       "reason": "...",
       "toolCall": { "name": "...", "arguments": { ... } },
       "source": "gpt" | "local"
     }
------------------------------------------------------------------ */

interface AgentDecisionRequest {
  observation: {
    journeyState: string;
    envEvent?: string;
    secondsRemaining?: number;
    userActive?: boolean;
    primaryAvailable?: boolean;
    from: string;
    to: string;
    primaryTrain: string;
    backupTrain: string | null;
    readinessDone: number;
    readinessTotal: number;
    tatkalOpensLabel: string;
    windowOpen: boolean;
    bookingStatus: string;
    notificationsSent: string[];
  };
}

export async function POST(req: Request) {
  let body: AgentDecisionRequest;
  try {
    body = (await req.json()) as AgentDecisionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { observation } = body;
  if (!observation) {
    return NextResponse.json({ error: "observation required" }, { status: 400 });
  }

  // Deterministic local fallback calculation
  const fallback = computeLocalDecision(observation);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...fallback, source: "local" });
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are the autonomous decision engine for Tatkal Copilot, an Indian railway booking agent.

Given the passenger's current observation, you MUST DECIDE the single best agent action to take right now.

Allowed actions (pick exactly one):
1. "none": No immediate action required.
2. "notify_user": Send a reminder or alert to the passenger.
3. "open_booking_flow": Initiate the booking attempt on the primary strategy.
4. "evaluate_backup": Assess the backup strategy because primary is unavailable or risky.
5. "activate_backup": Execute booking on the prepared backup strategy.

Allowed tool names for toolCall:
- "notifyUser" (arguments: { "channel": "push"|"whatsapp"|"in-app"|"email", "title": string, "message": string })
- "openBookingFlow" (arguments: {})
- "activateBackupStrategy" (arguments: {})
- "recordEvent" (arguments: { "kind": string, "text": string })

Rules:
- If userActive is false and secondsRemaining <= 30 and Tatkal window opens soon, pick "notify_user" with channel "whatsapp" or "push".
- If Tatkal window is open (windowOpen=true) and primaryAvailable=true and bookingStatus="none", pick "open_booking_flow".
- If primaryAvailable=false or bookingStatus="primary_failed", and backupTrain exists, pick "activate_backup".
- If booking is confirmed or no action needed, pick "none".
- Never invent facts. Output strictly valid JSON matching:
{
  "action": "notify_user" | "open_booking_flow" | "evaluate_backup" | "activate_backup" | "none",
  "reason": "Clear concise 1-2 sentence explanation of your decision",
  "toolCall": {
    "name": "notifyUser" | "openBookingFlow" | "activateBackupStrategy" | "recordEvent",
    "arguments": { ... }
  }
}`,
        },
        {
          role: "user",
          content: JSON.stringify(observation),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      action?: AllowedAgentAction;
      reason?: string;
      toolCall?: { name: AllowedAgentTool; arguments?: Record<string, unknown> };
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    if (!parsed.action || !["none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup"].includes(parsed.action)) {
      return NextResponse.json({ ...fallback, source: "local" });
    }

    return NextResponse.json({
      action: parsed.action,
      reason: parsed.reason || fallback.reason,
      toolCall: parsed.toolCall || fallback.toolCall,
      source: "gpt",
    });
  } catch (err) {
    console.warn("[api/agent-reason] OpenAI call failed, falling back to local engine:", err);
    return NextResponse.json({ ...fallback, source: "local" });
  }
}

/** Compute deterministic baseline decision when OpenAI is unavailable. */
function computeLocalDecision(obs: AgentDecisionRequest["observation"]): {
  action: AllowedAgentAction;
  reason: string;
  toolCall?: { name: AllowedAgentTool; arguments?: Record<string, unknown> };
} {
  if (obs.primaryAvailable === false && obs.backupTrain) {
    return {
      action: "activate_backup",
      reason: `Primary train unavailable. Local rule engine selected backup strategy: ${obs.backupTrain}`,
      toolCall: { name: "activateBackupStrategy", arguments: {} },
    };
  }

  if (obs.userActive === false && (obs.secondsRemaining ?? 999) <= 30) {
    return {
      action: "notify_user",
      reason: "Passenger inactive shortly before Tatkal window. Sending urgent notification.",
      toolCall: {
        name: "notifyUser",
        arguments: {
          channel: "whatsapp",
          title: "Tatkal Window Opening Soon",
          message: `Your Tatkal window opens in ${obs.secondsRemaining ?? 5} minutes. Open Tatkal Copilot to monitor booking.`,
        },
      },
    };
  }

  if (obs.windowOpen && obs.primaryAvailable !== false && obs.bookingStatus === "none") {
    return {
      action: "open_booking_flow",
      reason: "Tatkal window is open. Initiating primary booking strategy.",
      toolCall: { name: "openBookingFlow", arguments: {} },
    };
  }

  return {
    action: "none",
    reason: "Monitoring environment. Systems nominal.",
  };
}
