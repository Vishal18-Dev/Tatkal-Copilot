import { NextResponse } from "next/server";
import { endPhoneSession, updatePhoneSessionActivity } from "@/lib/calling/session-manager";

export const runtime = "nodejs";

/**
 * Telephony Call Status Webhook
 *
 * Receives lifecycle updates from Twilio (ringing, in-progress, completed, busy, failed)
 * and safely cleans up memory and active session state.
 */
export async function POST(req: Request) {
  const formData = await req.formData().catch(() => new FormData());
  const callSid = (formData.get("CallSid") as string) || "";
  const callStatus = (formData.get("CallStatus") as string) || "";

  console.info(`[calling/status] callSid=${callSid} status=${callStatus}`);

  if (["completed", "busy", "no-answer", "canceled", "failed"].includes(callStatus)) {
    endPhoneSession(callSid, callStatus);
  } else if (callSid) {
    updatePhoneSessionActivity(callSid);
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  return POST(req);
}
