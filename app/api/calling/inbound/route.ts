import { NextResponse } from "next/server";
import { getOrCreatePhoneSession, maskPhoneNumber } from "@/lib/calling/session-manager";

export const runtime = "nodejs";

/**
 * Inbound Call Webhook
 *
 * Triggered when a citizen dials the Tatkal Copilot phone number.
 * Greet contextual journey info or prompts for journey intent, then
 * establishes the conversational loop.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const queryCallSid = url.searchParams.get("callSid");

  const formData = await req.formData().catch(() => new FormData());
  const callSid = (formData.get("CallSid") as string) || queryCallSid || `inbound_${Date.now()}`;
  const from = (formData.get("From") as string) || "";
  const to = (formData.get("To") as string) || "";

  console.info(`[calling/inbound] received inbound callSid=${callSid} from=${maskPhoneNumber(from)}`);

  // Initialize/retrieve phone session
  const session = getOrCreatePhoneSession(callSid, {
    toNumber: to,
    fromNumber: from,
    language: "hi", // India-first default for telephony
  });

  const hasTrip = Boolean(session.trip);
  const greeting =
    session.briefing ||
    (hasTrip
      ? `नमस्ते, मैं आपका तत्काल कोपायलट हूँ। आपकी ${session.trip?.from ?? "यात्रा"} से ${session.trip?.to ?? "गंतव्य"} की यात्रा तैयार है। मैं आपकी क्या मदद कर सकता हूँ?`
      : "नमस्ते, मैं आपका तत्काल कोपायलट हूँ। अभी आपकी कोई सक्रिय यात्रा नहीं मिली है। आप कहाँ से कहाँ जाना चाहते हैं?");

  // TwiML response: Speak greeting inside Gather so caller can barge in and respond naturally
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  const actionUrl = `${protocol}://${host}/api/calling/respond?callSid=${encodeURIComponent(callSid)}`;

  const speechHints = "Pune, Mumbai, Delhi, Tatkal, AC 3 Tier, Rajdhani, confirm, train, booking, strategy, yes, no, haan, nahi, fastest, cheapest, backup";
  const twilioLang = session.language === "hi" ? "hi-IN" : "en-IN";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" language="${twilioLang}" timeout="8" speechTimeout="auto" hints="${escapeXml(speechHints)}" speechModel="experimental_conversations">
    <Say language="${twilioLang}" voice="Polly.Aditi">${escapeXml(greeting)}</Say>
  </Gather>
  <Redirect method="POST">${escapeXml(actionUrl)}</Redirect>
</Response>`;

  return new Response(twiml, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export async function GET(req: Request) {
  return POST(req);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
