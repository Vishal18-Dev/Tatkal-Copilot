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
    authorizationMode?: "assisted" | "permissioned";
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
1. "none": No immediate action required.
2. "notify_user": Send a targeted reminder or escalation alert to the passenger.
3. "open_booking_flow": Initiate the booking attempt on the primary strategy.
4. "evaluate_backup": Assess the backup strategy because primary is unavailable or risky.
5. "activate_backup": Execute booking on the prepared backup strategy.

CRITICAL AUTHORIZATION MODE RULES:
- authorizationMode = "assisted":
  * Passenger retains final booking authority.
  * When Tatkal window opens (windowOpen=true), NEVER pick "open_booking_flow" or "activate_backup". Pick "notify_user" or "none" to ask user to tap "Start booking".
  * If primary strategy fails, NEVER pick "activate_backup". Pick "notify_user" to advise user to tap "Use backup".
- authorizationMode = "permissioned":
  * Passenger granted authorization to execute booking strategy.
  * When Tatkal window opens (windowOpen=true) and primaryAvailable=true, pick "open_booking_flow".
  * If primary strategy fails and backup strategy exists, pick "activate_backup".

Rules for intelligent escalation:
- If userActive is FALSE and secondsRemaining <= 600: pick "notify_user" using channel "email" or "in-app", with priority "high" and notificationKey "tatkal_warning_10m".
- Never invent facts. Output strictly valid JSON.`,
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
        // Enforce mode boundaries
        if (observation.authorizationMode === "assisted" && (parsed.action === "open_booking_flow" || parsed.action === "activate_backup")) {
          return NextResponse.json({ ...fallback, source: "gpt" });
        }
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
    if (observation.authorizationMode === "assisted" && (geminiDecision.action === "open_booking_flow" || geminiDecision.action === "activate_backup")) {
      return NextResponse.json({ ...fallback, source: "gemini" });
    }
    return NextResponse.json(geminiDecision);
  }

  // 3. Deterministic local fallback
  return NextResponse.json({ ...fallback, source: "local" });
}

/** Fallback AI evaluation via Google Gemini REST API. */
async function callGeminiReasoning(observation: AgentDecisionRequest["observation"]) {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

  const prompt = `You are the autonomous decision engine for Tatkal Copilot. Return ONLY valid JSON with keys "action", "reason", "toolCall".
Allowed actions: "none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup".

CRITICAL AUTHORIZATION MODE RULES:
- authorizationMode = "assisted":
  * Passenger retains final booking authority.
  * When Tatkal window opens (windowOpen=true), NEVER pick "open_booking_flow" or "activate_backup". Pick "notify_user" or "none" to ask user to tap "Start booking".
  * If primary strategy fails, NEVER pick "activate_backup". Pick "notify_user" to advise user to tap "Use backup".
- authorizationMode = "permissioned":
  * Passenger granted authorization to execute booking strategy.
  * When Tatkal window opens (windowOpen=true) and primaryAvailable=true, pick "open_booking_flow".
  * If primary strategy fails and backup strategy exists, pick "activate_backup".

Observation:
${JSON.stringify(observation)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    let jsonStr = text.trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    if (!parsed.action || !["none", "notify_user", "open_booking_flow", "evaluate_backup", "activate_backup"].includes(parsed.action)) {
      return null;
    }

    let toolCall = parsed.toolCall;
    if (toolCall && !toolCall.name) {
      if (parsed.action === "notify_user") {
        toolCall = {
          name: "notifyUser",
          arguments: {
            channel: observation.channelPreferences?.email ? "email" : "in-app",
            priority: "high",
            title: "Tatkal Window Opening Soon",
            message: `Your Tatkal window opens soon for ${observation.from} → ${observation.to}.`,
            notificationKey: "tatkal_warning_10m",
          },
        };
      } else if (parsed.action === "open_booking_flow") {
        toolCall = { name: "openBookingFlow", arguments: {} };
      } else if (parsed.action === "activate_backup") {
        toolCall = { name: "activateBackupStrategy", arguments: {} };
      }
    }

    return {
      action: parsed.action as AllowedAgentAction,
      reason: parsed.reason || "Observation evaluated via Gemini.",
      toolCall,
      source: "gemini" as const,
    };
  } catch (err) {
    console.warn("[api/agent-reason] Gemini call failed:", err);
    return null;
  }
}

/** Compute deterministic baseline decision when AI is unavailable or as boundary fallback. */
function computeLocalDecision(obs: AgentDecisionRequest["observation"]): {
  action: AllowedAgentAction;
  reason: string;
  toolCall?: { name: AllowedAgentTool; arguments?: Record<string, unknown> };
} {
  const isAssisted = obs.authorizationMode === "assisted";

  if (obs.primaryAvailable === false || obs.bookingStatus === "primary_failed") {
    if (isAssisted) {
      const channel = obs.channelPreferences?.email ? "email" : "in-app";
      return {
        action: "notify_user",
        reason: "Primary strategy unavailable. User retains decision authority in Assisted mode — recommending backup.",
        toolCall: {
          name: "notifyUser",
          arguments: {
            channel,
            priority: "high",
            title: "Primary Strategy Unavailable",
            message: "Primary train unavailable. Tap 'Use backup' to switch strategy.",
            notificationKey: "assisted_primary_failed",
          },
        },
      };
    }

    if (obs.backupTrain) {
      return {
        action: "activate_backup",
        reason: `Primary train unavailable. Permissioned agent executing backup strategy: ${obs.backupTrain}`,
        toolCall: { name: "activateBackupStrategy", arguments: {} },
      };
    } else {
      const channel = obs.channelPreferences?.email ? "email" : "in-app";
      return {
        action: "notify_user",
        reason: "Primary train unavailable and no backup strategy configured. Escalating alert to passenger.",
        toolCall: {
          name: "notifyUser",
          arguments: {
            channel,
            priority: "high",
            title: "Primary Booking Failed",
            message: `Primary booking attempt failed for ${obs.from} → ${obs.to} and no backup strategy is configured.`,
            notificationKey: "primary_failed_no_backup",
          },
        },
      };
    }
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

  if (obs.windowOpen && (obs.primaryAvailable ?? true) && obs.bookingStatus === "none") {
    if (isAssisted) {
      const channel = obs.channelPreferences?.email ? "email" : "in-app";
      return {
        action: "notify_user",
        reason: "Tatkal window is open. Waiting for passenger to initiate booking in Assisted mode.",
        toolCall: {
          name: "notifyUser",
          arguments: {
            channel,
            priority: "high",
            title: "Tatkal Window Open",
            message: "Tatkal window is open! Tap 'Start booking' to begin.",
            notificationKey: "tatkal_open_assisted",
          },
        },
      };
    }

    return {
      action: "open_booking_flow",
      reason: "Tatkal window is open. Permissioned agent initiating primary booking strategy.",
      toolCall: { name: "openBookingFlow", arguments: {} },
    };
  }

  return {
    action: "none",
    reason: "Monitoring environment. Systems nominal.",
  };
}
