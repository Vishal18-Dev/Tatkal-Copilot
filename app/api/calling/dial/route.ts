import { NextResponse } from "next/server";
import { getOrCreatePhoneSession, maskPhoneNumber, rekeyPhoneSession } from "@/lib/calling/session-manager";

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
  const reason = (body.reason ?? "").trim();

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

  const tempCallSid = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const session = getOrCreatePhoneSession(tempCallSid, {
    toNumber: toE164,
    language: "hi",
    briefing,
    reason,
  });

  const statusUrl = `${protocol}://${host}/api/calling/status`;

  try {
    console.info(`[api/calling/dial] placing outbound call to=${maskPhoneNumber(toE164)}`);
    const publicUrl = process.env.TWILIO_WEBHOOK_URL || process.env.PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;

    let targetCallbackBase = `${protocol}://${host}`;
    if (publicUrl && !publicUrl.includes("localhost")) {
      targetCallbackBase = publicUrl.replace(/\/$/, "");
    }

    const formParams: Record<string, string> = {
      To: toE164,
      From: from,
      StatusCallback: statusUrl,
      StatusCallbackEvent: "completed",
    };

    if (body.url) {
      formParams.Url = body.url;
    } else if (host.includes("localhost") || host.includes("127.0.0.1")) {
      if (publicUrl && !publicUrl.includes("localhost")) {
        formParams.Url = `${publicUrl.replace(/\/$/, "")}/api/calling/inbound?callSid=${encodeURIComponent(tempCallSid)}`;
      } else {
        // Local development fallback — Twilio cloud servers cannot reach local host directly
        formParams.Url = "https://webhooks.twilio.com/v1/Voice/Template/voice_speech_recognition";
      }
    } else {
      formParams.Url = `${targetCallbackBase}/api/calling/inbound?callSid=${encodeURIComponent(tempCallSid)}`;
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
    rekeyPhoneSession(tempCallSid, realSid);
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

