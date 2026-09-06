import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Places a REAL outbound phone call to the user's mobile via a telephony vendor
 * (Twilio by default), speaking the Copilot's proactive briefing. This is the
 * production seam behind RealCallingProvider — the browser never sees any
 * credential; they stay here, server-side.
 *
 * Enabled only when the vendor env vars are set:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER      (an E.164 number you own on the vendor, e.g. +1...)
 * Without them the route returns { ok:false, reason:"not_configured" } and no
 * call is placed — the app falls back to the in-browser simulated call.
 *
 * NOTE: this first version speaks the briefing (a one-way proactive call). A
 * full two-way phone conversation needs the vendor's media-stream webhooks
 * bridged to realtime STT/TTS driving lib/copilot per turn — the SAME tool
 * layer browser voice uses. That bridge is intentionally left as the next step.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    briefing?: string;
  };
  const to = (body.to ?? "").trim();
  const briefing = (body.briefing ?? "").trim().slice(0, 1000);

  if (!to || !/^\+?[0-9\s-]{8,15}$/.test(to)) {
    return NextResponse.json({ ok: false, reason: "invalid_number" }, { status: 400 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    // Honest: nothing is dialled unless real telephony is configured.
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  const toE164 = to.startsWith("+") ? to.replace(/[\s-]/g, "") : `+91${to.replace(/[\s-]/g, "")}`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">${escapeXml(
    briefing || "This is your Tatkal Copilot with an update on your journey."
  )}</Say></Response>`;

  try {
    const form = new URLSearchParams({ To: toE164, From: from, Twiml: twiml });
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
      return NextResponse.json({ ok: false, reason: "vendor_error" }, { status: 502 });
    }
    console.info(`[api/calling/dial] placed call sid=${data.sid}`);
    return NextResponse.json({ ok: true, sid: data.sid, simulated: false });
  } catch (err) {
    console.warn(`[api/calling/dial] ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ ok: false, reason: "network_error" }, { status: 502 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
