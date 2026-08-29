import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { AllowedAgentAction, AllowedAgentTool } from "@/lib/action-validator";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/* ------------------------------------------------------------------
   Agent Decision API (v1.6 Genuine Agent Decision Loop + Escalation)

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
    channelPreferences?: { inApp: boolean; email: boolean; whatsappDemo: boolean };
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

  // 1. Try OpenAI if key is present
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey });
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
1. "none": No immediate action required. Do NOT notify if user is active or no intervention is warranted.
2. "notify_user": Send a targeted reminder or escalation alert to the passenger.
3. "open_booking_flow": Initiate the booking attempt on the primary strategy.
4. "evaluate_backup": Assess the backup strategy because primary is unavailable or risky.
5. "activate_backup": Execute booking on the prepared backup strategy.

Allowed tool names for toolCall:
- "notifyUser" (arguments: { "channel": "email"|"in-app"|"whatsapp"|"push", "priority": "low"|"medium"|"high", "title": string, "message": string, "notificationKey": string })
- "openBookingFlow" (arguments: {})
- "activateBackupStrategy" (arguments: {})
- "recordEvent" (arguments: { "kind": string, "text": string })

Rules for intelligent escalation:
- If userActive is TRUE: do NOT notify unnecessarily. Choose "none" unless booking requires user action.
- If userActive is FALSE and secondsRemaining <= 600 (10 minutes or 5 minutes before Tatkal): pick "notify_user" using channel "email" (if channelPreferences.email is true) or "in-app", with priority "high" and notificationKey "tatkal_warning_10m".
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

      if (parsed.action && ["none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup"].includes(parsed.action)) {
        return NextResponse.json({
          action: parsed.action,
          reason: parsed.reason || fallback.reason,
          toolCall: parsed.toolCall || fallback.toolCall,
          source: "gpt",
        });
      }
    } catch (err) {
      console.warn("[api/agent-reason] OpenAI call failed, checking Gemini fallback:", err);
    }
  }

  // 2. Try Gemini fallback if OpenAI failed or key is absent
  const geminiDecision = await callGeminiReasoning(observation);
  if (geminiDecision) {
    return NextResponse.json(geminiDecision);
  }

  // 3. Deterministic local fallback
  return NextResponse.json({ ...fallback, source: "local" });
}

/** Fallback AI evaluation via Google Gemini REST API. */
async function callGeminiReasoning(observation: AgentDecisionRequest["observation"]) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const prompt = `You are the autonomous decision engine for Tatkal Copilot, an Indian railway booking agent.

Given the passenger's current observation, you MUST DECIDE the single best agent action to take right now.

Allowed actions: "none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup".
Allowed tool names: "notifyUser", "openBookingFlow", "activateBackupStrategy", "recordEvent".

Rules for intelligent escalation:
- If userActive is TRUE: choose "none" unless booking requires user action.
- If userActive is FALSE and secondsRemaining <= 600: pick "notify_user" using channel "email" or "in-app", with priority "high" and notificationKey "tatkal_warning_10m".
- If Tatkal window is open and primaryAvailable=true and bookingStatus="none", pick "open_booking_flow".
- If primaryAvailable=false, pick "activate_backup".

Output strictly JSON matching:
{
  "action": "notify_user" | "open_booking_flow" | "evaluate_backup" | "activate_backup" | "none",
  "reason": "Explanation",
  "toolCall": { "name": "notifyUser" | "openBookingFlow" | "activateBackupStrategy" | "recordEvent", "arguments": { ... } }
}

Observation:
${JSON.stringify(observation)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!parsed.action || !["none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup"].includes(parsed.action)) {
      return null;
    }
    return {
      action: parsed.action as AllowedAgentAction,
      reason: parsed.reason || "Observation evaluated via Gemini.",
      toolCall: parsed.toolCall,
      source: "gemini" as const,
    };
  } catch (err) {
    console.warn("[api/agent-reason] Gemini call failed:", err);
    return null;
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

  if (obs.userActive === false && (obs.secondsRemaining ?? 999) <= 600) {
    const channel = obs.channelPreferences?.email ? "email" : "in-app";
    return {
      action: "notify_user",
      reason: "Passenger inactive shortly before Tatkal window. Escalating via " + channel + ".",
      toolCall: {
        name: "notifyUser",
        arguments: {
          channel,
          priority: "high",
          title: "Tatkal Window Opening Soon",
          message: `Your Tatkal window opens soon for ${obs.from} → ${obs.to}. Open Tatkal Copilot to monitor booking.`,
          notificationKey: "tatkal_warning_10m",
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
