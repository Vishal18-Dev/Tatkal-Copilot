import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelephonyAudioAdapter } from "@/lib/calling/telephony-adapter";
import {
  getOrCreatePhoneSession,
  getPhoneSession,
  bindStreamToCall,
  getPhoneSessionByStream,
  endPhoneSession,
  maskPhoneNumber,
} from "@/lib/calling/session-manager";
import { POST as inboundHandler } from "@/app/api/calling/inbound/route";
import { POST as respondHandler } from "@/app/api/calling/respond/route";
import { POST as statusHandler } from "@/app/api/calling/status/route";
import { POST as streamHandler } from "@/app/api/calling/stream/route";
import { POST as dialHandler } from "@/app/api/calling/dial/route";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import type { Trip } from "@/types";

describe("Item 5C — Two-Way Phone Calling Agent", () => {
function createMockTrip(mode: "assisted" | "auto" = "assisted", overrides?: Partial<Trip>): Trip {
  return {
    id: "trip_mumbai_delhi",
    status: "upcoming",
    from: "Mumbai Central",
    fromCode: "MMCT",
    to: "New Delhi",
    toCode: "NDLS",
    dateLabel: "Tomorrow",
    trainName: "12953 August Kranti Tejas Rajdhani",
    travelClass: "3A",
    travellerIds: ["p1", "p2"],
    boardingStationName: "Borivali",
    arrivalDisplay: "08:30 · tomorrow",
    fare: 2450,
    mode,
    agentState: "scheduled",
    agentEnabled: true,
    tatkalOpensAtLabel: "10:00 AM",
    primary: {
      optionId: "opt_primary",
      trainName: "12953 August Kranti Tejas Rajdhani",
      travelClass: "3A",
      boardingStationName: "Borivali",
      departureDisplay: "17:05",
      arrivalDisplay: "08:30 · tomorrow",
      level: "High",
      fare: 2450,
    },
    backup: {
      optionId: "opt_backup",
      trainName: "Split via Kota Junction",
      travelClass: "3A",
      boardingStationName: "Mumbai Central",
      departureDisplay: "16:35",
      arrivalDisplay: "12:20 · tomorrow",
      level: "Very High",
      fare: 2600,
      via: "Kota Junction",
    },
    readinessDone: [],
    planNotifications: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const mockTrip = createMockTrip("assisted");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. TelephonyAudioAdapter (μ-law, 8kHz/16kHz conversion, Twilio framing)", () => {
    it("converts 8kHz μ-law to 16kHz linear PCM correctly", () => {
      const adapter = new TelephonyAudioAdapter();
      // 100 bytes of 8kHz ulaw
      const ulawBuffer = Buffer.alloc(100, 0xff); // 0xff is silence in ulaw
      const base64Ulaw = ulawBuffer.toString("base64");

      const pcm16k = adapter.decodeUlaw8kToPcm16k(base64Ulaw);
      // 100 samples upsampled 2x = 200 samples = 400 bytes (16-bit LE)
      expect(pcm16k.byteLength).toBe(400);
      expect(pcm16k.readInt16LE(0)).toBeDefined();
    });

    it("encodes 16kHz linear PCM to 8kHz μ-law base64 string correctly", () => {
      const adapter = new TelephonyAudioAdapter();
      // 200 samples of 16-bit linear PCM (400 bytes)
      const pcmBuffer = Buffer.alloc(400, 0x00);

      const base64Ulaw = adapter.encodePcm16kToUlaw8k(pcmBuffer);
      expect(typeof base64Ulaw).toBe("string");
      const decodedBytes = Buffer.from(base64Ulaw, "base64");
      // Downsampled 2:1 = 100 samples (100 bytes)
      expect(decodedBytes.length).toBe(100);
    });

    it("handles round-trip audio conversion without throw or NaN", () => {
      const adapter = new TelephonyAudioAdapter();
      const originalSamples = 160; // 10ms at 16kHz
      const pcmInput = Buffer.alloc(originalSamples * 2);
      for (let i = 0; i < originalSamples; i++) {
        pcmInput.writeInt16LE(Math.floor(Math.sin(i / 10) * 10000), i * 2);
      }

      const ulawBase64 = adapter.encodePcm16kToUlaw8k(pcmInput);
      const reconstructedPcm = adapter.decodeUlaw8kToPcm16k(ulawBase64);

      expect(reconstructedPcm.byteLength).toBe(pcmInput.byteLength);
    });

    it("parses Twilio media stream messages and captures streamSid / callSid", () => {
      const adapter = new TelephonyAudioAdapter();
      const startPayload = JSON.stringify({
        event: "start",
        sequenceNumber: "1",
        start: {
          streamSid: "MZ1234567890",
          accountSid: "AC12345",
          callSid: "CAabcdef12345",
          tracks: ["inbound"],
        },
      });

      const parsed = adapter.parseMessage(startPayload);
      expect(parsed?.event).toBe("start");
      expect(adapter.getStreamSid()).toBe("MZ1234567890");
      expect(adapter.getCallSid()).toBe("CAabcdef12345");
    });

    it("creates Twilio media, mark, and barge-in clear frames", () => {
      const adapter = new TelephonyAudioAdapter("MZ12345", "CA12345");

      const mediaFrame = JSON.parse(adapter.createMediaFrame("payload123"));
      expect(mediaFrame.event).toBe("media");
      expect(mediaFrame.streamSid).toBe("MZ12345");
      expect(mediaFrame.media.payload).toBe("payload123");

      const clearFrame = JSON.parse(adapter.createClearFrame());
      expect(clearFrame.event).toBe("clear");
      expect(clearFrame.streamSid).toBe("MZ12345");

      const markFrame = JSON.parse(adapter.createMarkFrame("segment_1"));
      expect(markFrame.event).toBe("mark");
      expect(markFrame.streamSid).toBe("MZ12345");
      expect(markFrame.mark.name).toBe("segment_1");
    });

    it("returns null safely on invalid or malformed JSON payloads", () => {
      const adapter = new TelephonyAudioAdapter();
      expect(adapter.parseMessage("not a valid json {{{{")).toBeNull();
    });
  });

  describe("2. Phone Session Management & Privacy Masking", () => {
    it("masks phone numbers to protect citizen PII in logs", () => {
      expect(maskPhoneNumber("+919876543210")).toBe("+9198****3210");
      expect(maskPhoneNumber("+918888777700")).toBe("+9188****7700");
      expect(maskPhoneNumber("1234")).toBe("***");
      expect(maskPhoneNumber(undefined)).toBe("unknown");
    });

    it("creates, retrieves, and updates phone sessions", () => {
      const callSid = `call_test_${Date.now()}`;
      const session = getOrCreatePhoneSession(callSid, {
        trip: mockTrip,
        language: "hi",
        toNumber: "+919876543210",
      });

      expect(session.callSid).toBe(callSid);
      expect(session.language).toBe("hi");
      expect(session.trip?.id).toBe("trip_mumbai_delhi");
      expect(session.status).toBe("initiated");

      // Bind stream
      const streamSid = `stream_${Date.now()}`;
      bindStreamToCall(streamSid, callSid);
      expect(session.streamSid).toBe(streamSid);
      expect(session.status).toBe("connected");

      const retrieved = getPhoneSessionByStream(streamSid);
      expect(retrieved?.callSid).toBe(callSid);

      // Teardown
      endPhoneSession(callSid, "test_complete");
      expect(getPhoneSession(callSid)).toBeUndefined();
      expect(getPhoneSessionByStream(streamSid)).toBeUndefined();
    });
  });

  describe("3. Inbound Call Webhook (/api/calling/inbound)", () => {
    it("returns TwiML with greeting and speech gather for active trip", async () => {
      const callSid = `inbound_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip, language: "hi" });

      const form = new FormData();
      form.append("CallSid", callSid);
      form.append("From", "+919876543210");
      form.append("To", "+911123456789");

      const req = new Request("http://localhost:3000/api/calling/inbound", {
        method: "POST",
        body: form,
      });

      const res = await inboundHandler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/xml");

      const twiml = await res.text();
      expect(twiml).toContain("<Response>");
      expect(twiml).toContain("<Gather");
      expect(twiml).toContain('input="speech"');
      expect(twiml).toContain("/api/calling/respond");
      expect(twiml).toContain("तत्काल कोपायलट");
    });

    it("returns prompt asking for origin and destination when no trip is active", async () => {
      const callSid = `inbound_notrip_${Date.now()}`;
      const form = new FormData();
      form.append("CallSid", callSid);

      const req = new Request("http://localhost:3000/api/calling/inbound", {
        method: "POST",
        body: form,
      });

      const res = await inboundHandler(req);
      const twiml = await res.text();
      expect(twiml).toContain("सक्रिय यात्रा नहीं मिली");
      expect(twiml).toContain("कहाँ से कहाँ");
    });
  });

  describe("4. Telephony Conversational Turn (/api/calling/respond)", () => {
    it("executes phone turn through executeCopilotTurn and outputs conversational TwiML", async () => {
      const callSid = `call_respond_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip, language: "en" });

      const req = new Request("http://localhost:3000/api/calling/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSid,
          text: "What is my backup train?",
          languageCode: "en-IN",
        }),
      });

      const res = await respondHandler(req);
      expect(res.status).toBe(200);
      const twiml = await res.text();

      expect(twiml).toContain("<Say");
      expect(twiml).toContain("Split via Kota Junction");
      expect(twiml).toContain("<Gather");

      const session = getPhoneSession(callSid);
      expect(session).toBeDefined();
      const messages = session!.conversation.messages;
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Canonical conversation channel invariant
      const userMsg = messages[messages.length - 2];
      expect(userMsg.channel).toBe("phone");
      expect(userMsg.originalText).toBe("What is my backup train?");
    });

    it("handles Hindi / Hinglish phone speech gracefully", async () => {
      const callSid = `call_hi_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip, language: "hi" });

      const req = new Request("http://localhost:3000/api/calling/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSid,
          text: "Mujhe backup train dikhao",
          languageCode: "hi-IN",
        }),
      });

      const res = await respondHandler(req);
      const twiml = await res.text();
      expect(twiml).toContain("<Say");

      const session = getPhoneSession(callSid);
      const lastUserMsg = session?.conversation.messages.filter((m) => m.role === "user").pop();
      expect(lastUserMsg?.channel).toBe("phone");
      expect(lastUserMsg?.originalText).toBe("Mujhe backup train dikhao");
    });

    it("hangs up cleanly on farewell keywords", async () => {
      const callSid = `call_bye_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip, language: "hi" });

      const req = new Request("http://localhost:3000/api/calling/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSid,
          text: "theek hai, shukriya, alvida",
          languageCode: "hi-IN",
        }),
      });

      const res = await respondHandler(req);
      const twiml = await res.text();
      expect(twiml).toContain("<Hangup/>");
      expect(twiml).toContain("शुभ यात्रा");
    });

    it("prompts to repeat on silence or empty transcript", async () => {
      const callSid = `call_silent_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip, language: "hi" });

      const req = new Request("http://localhost:3000/api/calling/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSid,
          text: "   ",
        }),
      });

      const res = await respondHandler(req);
      const twiml = await res.text();
      expect(twiml).toContain("दोहरा सकते हैं");
      expect(twiml).toContain("<Gather");
    });
  });

  describe("5. Telephony Media Stream Bridge (/api/calling/stream)", () => {
    it("initializes media stream and binds streamSid to callSid", async () => {
      const callSid = `call_bridge_${Date.now()}`;
      const streamSid = `MZ_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip });

      const req = new Request("http://localhost:3000/api/calling/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "start",
          streamSid,
          callSid,
        }),
      });

      const res = await streamHandler(req);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.status).toBe("started");

      const session = getPhoneSessionByStream(streamSid);
      expect(session?.callSid).toBe(callSid);
    });

    it("emits clear frame for barge-in interruption", async () => {
      const streamSid = `MZ_bargein_${Date.now()}`;
      const req = new Request("http://localhost:3000/api/calling/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interrupted: true,
          streamSid,
        }),
      });

      const res = await streamHandler(req);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.clearFrame.event).toBe("clear");
      expect(json.clearFrame.streamSid).toBe(streamSid);
    });

    it("decodes incoming μ-law audio payload to 16kHz linear PCM", async () => {
      const ulawBuffer = Buffer.alloc(160, 0xff); // 20ms at 8kHz
      const req = new Request("http://localhost:3000/api/calling/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: ulawBuffer.toString("base64"),
        }),
      });

      const res = await streamHandler(req);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.pcmByteLength).toBe(640); // 320 samples * 2 bytes
      expect(json.samples).toBe(320);
    });
  });

  describe("6. Telephony Call Lifecycle Status & Teardown (/api/calling/status)", () => {
    it("cleans up session when call status reaches completed or failed", async () => {
      const callSid = `call_status_${Date.now()}`;
      getOrCreatePhoneSession(callSid, { trip: mockTrip });
      expect(getPhoneSession(callSid)).toBeDefined();

      const form = new FormData();
      form.append("CallSid", callSid);
      form.append("CallStatus", "completed");

      const req = new Request("http://localhost:3000/api/calling/status", {
        method: "POST",
        body: form,
      });

      const res = await statusHandler(req);
      expect(res.status).toBe(200);
      expect(getPhoneSession(callSid)).toBeUndefined();
    });
  });

  describe("7. Outbound Call Dial Route (/api/calling/dial)", () => {
    it("returns not_configured when Twilio credentials are not set", async () => {
      const req = new Request("http://localhost:3000/api/calling/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "9876543210" }),
      });

      const res = await dialHandler(req);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.reason).toBe("not_configured");
    });

    it("rejects invalid mobile numbers", async () => {
      const req = new Request("http://localhost:3000/api/calling/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "invalid" }),
      });

      const res = await dialHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.reason).toBe("invalid_number");
    });
  });

  describe("8. Authorization Invariant on Phone Channel", () => {
    it("Assisted mode: blocks autonomous booking triggers over the phone", async () => {
      const result = await executeCopilotTurn({
        channel: "phone",
        text: "book it now",
        language: "en",
        trip: createMockTrip("assisted"),
        isUserInitiated: false, // Autonomous / non-user initiated attempt
      });

      // Must be blocked by Action Validator
      expect(result.channel).toBe("phone");
      expect(result.validation?.valid).toBe(false);
      expect(result.validation?.reason).toContain("Assisted mode requires explicit user initiation");
    });

    it("Assisted mode: requires confirmation for booking", async () => {
      const result = await executeCopilotTurn({
        channel: "phone",
        text: "book it now",
        language: "en",
        trip: createMockTrip("assisted"),
        isUserInitiated: true,
      });

      expect(result.channel).toBe("phone");
      expect(result.toolUsed).toBe("request_booking_confirmation");
      expect(result.actionPlan?.requiresConfirmation).toBe(true);
      expect(result.validation?.valid).toBe(true);
      expect(result.speakEnglish).toContain("Ready to book");
    });

    it("Permissioned mode: allows pre-authorized tool executions", async () => {
      const result = await executeCopilotTurn({
        channel: "phone",
        text: "Switch to backup train",
        language: "en",
        trip: createMockTrip("auto"),
        isUserInitiated: true,
      });

      expect(result.channel).toBe("phone");
      expect(result.toolUsed).toBe("use_backup_option");
      expect(result.validation?.valid).toBe(true);
      expect(result.actionPlan?.permission).toBe("booking");
    });
  });
});

