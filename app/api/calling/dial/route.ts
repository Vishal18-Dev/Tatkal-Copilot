import { NextResponse } from "next/server";
import { getOrCreatePhoneSession, maskPhoneNumber } from "@/lib/calling/session-manager";

export const runtime = "nodejs";

/**
 * Places a REAL outbound phone call to the user's mobile via Twilio,
 * connecting the call to a bidirectional Media Stream WebSocket / TwiML bridge.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    briefing?: string;
    reason?: string;
    tripId?: string;
    toName?: string;
    url?: string;
  };

  const to = (body.to ?? "").trim();
  const briefing = (body.briefing ?? "").trim().slice(0, 1000);

  if (!to || !/^\+?[0-9\s-]{8,15}$/.test(to)) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.warn("[api/calling/dial] missing Twilio production credentials");
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const toE164 = to.startsWith("+") ? to.replace(/[\s-]/g, "") : `+91${to.replace(/[\s-]/g, "")}`;
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const wsProtocol = host.includes("localhost") ? "ws" : "wss";

  const tempCallSid = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const session = getOrCreatePhoneSession(tempCallSid, {
    toNumber: toE164,
    language: "hi",
  });

  const actionUrl = `${protocol}://${host}/api/calling/respond?callSid=${encodeURIComponent(tempCallSid)}`;
  const statusUrl = `${protocol}://${host}/api/calling/status`;
  const streamUrl = `${wsProtocol}://${host}/api/calling/stream?callSid=${encodeURIComponent(tempCallSid)}`;

  // Contextual Opening (Spec Requirement §8)
  let openingGreeting = briefing;
  if (!openingGreeting) {
    if (session.trip) {
      openingGreeting = `Hi, this is Tatkal Copilot. You asked me to help with your ${session.trip.from} to ${session.trip.to} Tatkal journey. I have your journey context ready. Would you like me to walk you through the options?`;
    } else {
      openingGreeting = "Hi, this is Tatkal Copilot. I'm ready to help plan your Tatkal journey. Where would you like to travel?";
    }
  }

  // TwiML with bidirectional Media Stream (Spec Requirement §2)
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
  <Say voice="Polly.Aditi">${escapeXml(openingGreeting)}</Say>
  <Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" language="hi-IN" speechTimeout="auto" speechModel="experimental_conversations">
    <Say voice="Polly.Aditi">मैं सुन रहा हूँ। आप क्या करना चाहेंगे?</Say>
  </Gather>
  <Redirect method="POST">${escapeXml(actionUrl)}</Redirect>
</Response>`;

  try {
    console.info(`[api/calling/dial] placing outbound call to=${maskPhoneNumber(toE164)}`);
    const formParams: Record<string, string> = {
      To: toE164,
      From: from,
      StatusCallback: statusUrl,
      StatusCallbackEvent: "completed",
    };

    const publicUrl = process.env.TWILIO_WEBHOOK_URL || process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (body.url) {
      formParams.Url = body.url;
    } else if (publicUrl && !publicUrl.includes("localhost")) {
      formParams.Url = `${publicUrl.replace(/\/$/, "")}/api/calling/inbound`;
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
      // Local development fallback — Twilio cloud servers cannot reach local host directly
      formParams.Url = "https://webhooks.twilio.com/v1/Voice/Template/voice_speech_recognition";
    } else {
      formParams.Url = `${protocol}://${host}/api/calling/inbound`;
    }

    const form = new URLSearchParams(formParams);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };

    if (!res.ok) {
      console.warn(`[api/calling/dial] vendor error: ${data.message ?? res.status}`);
      return NextResponse.json(
        { ok: false, reason: "vendor_error", error: data.message || `Twilio HTTP error ${res.status}` },
        { status: 502 }
      );
    }

    const realSid = data.sid || tempCallSid;
    console.info(`[api/calling/dial] call started sid=${realSid} to=${maskPhoneNumber(toE164)}`);

    return NextResponse.json({ ok: true, sid: realSid, simulated: false });
  } catch (err) {
    console.warn(`[api/calling/dial] call error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ ok: false, reason: "network_error" }, { status: 502 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

