import { NextResponse } from "next/server";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { getOrCreatePhoneSession, getPhoneSession, updatePhoneSessionActivity } from "@/lib/calling/session-manager";
import { fromBcp47, type VoiceLang } from "@/lib/voice/languages";

export const runtime = "nodejs";

/**
 * Telephony Conversational Turn Handler
 *
 * Implements the core conversational loop:
 *   Caller speaks -> STT -> executeCopilotTurn() -> validateAgentDecision() -> TwiML Speak -> Listen Again
 *
 * Both Twilio Form POST and JSON POST are supported.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const queryCallSid = url.searchParams.get("callSid");

  let callSid = queryCallSid ?? "";
  let userText = "";
  let detectedLangCode = "hi-IN";
  let confidence = 1.0;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    callSid = json.callSid || callSid || `call_${Date.now()}`;
    userText = (json.text || json.transcript || "").trim();
    detectedLangCode = json.languageCode || json.lang || "hi-IN";
    confidence = json.confidence ?? 1.0;
  } else {
    // Twilio Webhook Form Data
    const formData = await req.formData().catch(() => new FormData());
    callSid = (formData.get("CallSid") as string) || callSid || `call_${Date.now()}`;
    userText = ((formData.get("SpeechResult") as string) || "").trim();
    detectedLangCode = (formData.get("Language") as string) || "hi-IN";
    const confStr = formData.get("Confidence") as string;
    confidence = confStr ? parseFloat(confStr) : 1.0;
  }

  const session = getOrCreatePhoneSession(callSid);
  updatePhoneSessionActivity(callSid);

  // If no speech was captured (silence or timeout)
  if (!userText) {
    const retryTwiml = buildTwimlResponse(
      callSid,
      "माफ़ कीजिए, मैं सुन नहीं सका। क्या आप दोहरा सकते हैं?",
      session.language,
      req
    );
    return new Response(retryTwiml, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
  }

  // Follow detected language if provided
  const detectedLang: VoiceLang = fromBcp47(detectedLangCode) ?? session.language;
  session.language = detectedLang;

  console.info(
    `[calling/respond] turn callSid=${callSid} user="${userText}" lang=${detectedLang} conf=${confidence}`
  );

  // Execute canonical Copilot Turn - The SAME brain as Browser Voice and Visual UI
  const copilotResult = await executeCopilotTurn({
    channel: "phone",
    text: userText,
    language: detectedLang,
    trip: session.trip,
    conversation: session.conversation,
    isUserInitiated: true,
  });

  // Update session conversation state
  session.conversation = copilotResult.conversation;
  const assistantReply = copilotResult.assistantMessage.originalText;

  // Check if conversation concluded (e.g. user said goodbye or finished)
  const isFarewell = /\b(bye|goodbye|alvida|tata|dhanyawad|shukriya|thanks|exit|quit|stop)\b/i.test(userText);

  if (isFarewell) {
    const farewellTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${getTwilioLang(detectedLang)}" voice="Polly.Aditi">${escapeXml(assistantReply)}</Say>
  <Say language="${getTwilioLang(detectedLang)}" voice="Polly.Aditi">तत्काल कोपायलट का उपयोग करने के लिए धन्यवाद। शुभ यात्रा!</Say>
  <Hangup/>
</Response>`;
    return new Response(farewellTwiml, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
  }

  // Render conversational loop TwiML
  const twiml = buildTwimlResponse(callSid, assistantReply, detectedLang, req);
  return new Response(twiml, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

function buildTwimlResponse(callSid: string, speakText: string, lang: VoiceLang, req: Request): string {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const actionUrl = `${protocol}://${host}/api/calling/respond?callSid=${encodeURIComponent(callSid)}`;
  const twilioLang = getTwilioLang(lang);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${twilioLang}" voice="Polly.Aditi">${escapeXml(speakText)}</Say>
  <Gather input="speech" action="${escapeXml(actionUrl)}" method="POST" language="${twilioLang}" speechTimeout="auto" speechModel="experimental_conversations">
  </Gather>
  <Redirect method="POST">${escapeXml(actionUrl)}</Redirect>
</Response>`;
}

function getTwilioLang(lang: VoiceLang): string {
  switch (lang) {
    case "hi":
      return "hi-IN";
    case "ta":
      return "ta-IN";
    case "te":
      return "te-IN";
    case "kn":
      return "kn-IN";
    case "mr":
      return "mr-IN";
    case "gu":
      return "gu-IN";
    case "ml":
      return "ml-IN";
    case "en":
    default:
      return "en-IN";
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}
