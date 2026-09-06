import type { Conversation } from "@/lib/conversation/types";
import { createConversation } from "@/lib/conversation/service";
import type { VoiceLang } from "@/lib/voice/languages";
import type { Trip } from "@/types";

export interface PhoneSession {
  callSid: string;
  streamSid?: string;
  conversation: Conversation;
  trip?: Trip;
  briefing?: string;
  reason?: string;
  language: VoiceLang;
  status: "initiated" | "ringing" | "connected" | "active" | "ended";
  isSpeaking: boolean;
  toNumber?: string;
  fromNumber?: string;
  lastActivity: number;
  timer?: NodeJS.Timeout;
}

const callSessions = new Map<string, PhoneSession>();
const streamToCallMap = new Map<string, string>();

const SESSION_INACTIVITY_MS = 120_000; // 2 mins inactivity cleanup
const SESSION_MAX_DURATION_MS = 900_000; // 15 mins max call duration

/**
 * Mask phone numbers for privacy in structured logs.
 * Example: "+919876543210" -> "+9198****3210"
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return "unknown";
  const cleaned = phone.trim();
  if (cleaned.length <= 6) return "***";
  const prefix = cleaned.slice(0, 5);
  const suffix = cleaned.slice(-4);
  return `${prefix}****${suffix}`;
}

export function getOrCreatePhoneSession(
  callSid: string,
  options?: {
    trip?: Trip;
    briefing?: string;
    reason?: string;
    language?: VoiceLang;
    toNumber?: string;
    fromNumber?: string;
  }
): PhoneSession {
  let session = callSessions.get(callSid);
  if (!session) {
    const language: VoiceLang = options?.language ?? "en";
    const conversation = createConversation({
      channel: "phone",
      language,
      sessionId: callSid,
      tripId: options?.trip?.id,
      metadata: {
        callSid,
        toNumber: options?.toNumber ? maskPhoneNumber(options.toNumber) : undefined,
      },
    });

    session = {
      callSid,
      conversation,
      trip: options?.trip,
      briefing: options?.briefing,
      reason: options?.reason,
      language,
      status: "initiated",
      isSpeaking: false,
      toNumber: options?.toNumber,
      fromNumber: options?.fromNumber,
      lastActivity: Date.now(),
    };

    // Auto-teardown timer
    session.timer = setTimeout(() => {
      endPhoneSession(callSid, "session_timeout");
    }, SESSION_MAX_DURATION_MS);

    callSessions.set(callSid, session);
    console.info(`[phone-session] created session callSid=${callSid} to=${maskPhoneNumber(options?.toNumber)}`);
  } else if (options) {
    if (options.trip) session.trip = options.trip;
    if (options.briefing) session.briefing = options.briefing;
    if (options.reason) session.reason = options.reason;
    if (options.language) session.language = options.language;
    session.lastActivity = Date.now();
  }

  return session;
}

export function rekeyPhoneSession(oldCallSid: string, newCallSid: string): PhoneSession | undefined {
  if (oldCallSid === newCallSid) return callSessions.get(oldCallSid);
  const session = callSessions.get(oldCallSid);
  if (!session) return undefined;

  callSessions.delete(oldCallSid);
  session.callSid = newCallSid;
  session.conversation.id = newCallSid;
  callSessions.set(newCallSid, session);
  console.info(`[phone-session] rekeyed session oldSid=${oldCallSid} -> newSid=${newCallSid}`);
  return session;
}

export function bindStreamToCall(streamSid: string, callSid: string): void {
  streamToCallMap.set(streamSid, callSid);
  const session = callSessions.get(callSid);
  if (session) {
    session.streamSid = streamSid;
    session.status = "connected";
    session.lastActivity = Date.now();
  }
}

export function getPhoneSessionByStream(streamSid: string): PhoneSession | undefined {
  const callSid = streamToCallMap.get(streamSid);
  if (!callSid) return undefined;
  return callSessions.get(callSid);
}

export function getPhoneSession(callSid: string): PhoneSession | undefined {
  return callSessions.get(callSid);
}

export function updatePhoneSessionActivity(callSid: string): void {
  const session = callSessions.get(callSid);
  if (session) {
    session.lastActivity = Date.now();
  }
}

export function endPhoneSession(callSid: string, reason = "normal_hangup"): void {
  const session = callSessions.get(callSid);
  if (!session) return;

  session.status = "ended";
  if (session.timer) clearTimeout(session.timer);
  if (session.streamSid) streamToCallMap.delete(session.streamSid);
  callSessions.delete(callSid);

  console.info(`[phone-session] ended callSid=${callSid} reason=${reason}`);
}
