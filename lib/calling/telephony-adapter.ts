/**
 * TelephonyAudioAdapter
 *
 * Dedicated telephony audio adapter for telephony vendors (Twilio / Exotel):
 * - μ-law (G.711u) audio decoding (8kHz, 8-bit) to linear PCM (16kHz, 16-bit) for Sarvam STT
 * - linear PCM (16kHz, 16-bit) to μ-law (8kHz, 8-bit) encoding for telephony playback
 * - Twilio Media Stream message schema serialization and parsing
 * - Barge-in "clear" frame emission to immediately halt telephony playback
 *
 * ARCHITECTURAL RULE:
 * Telephony audio mechanics belong exclusively here. Never put μ-law conversion
 * inside executeCopilotTurn, canonical conversation, Action Validator, or UI.
 */

// G.711 μ-law expansion table (8-bit μ-law -> 16-bit signed PCM)
const ULAW_EXP_TABLE = new Int16Array(256);

(function initUlawTable() {
  for (let i = 0; i < 256; i++) {
    const complement = ~i & 0xff;
    const sign = complement & 0x80;
    const exponent = (complement >> 4) & 0x07;
    const mantissa = complement & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    ULAW_EXP_TABLE[i] = sign !== 0 ? -sample : sample;
  }
})();

// G.711 μ-law compression: 16-bit linear PCM -> 8-bit μ-law
function linearToUlaw(pcmSample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;

  let sample = Math.max(-CLIP, Math.min(CLIP, pcmSample));
  const sign = sample < 0 ? 0x80 : 0x00;
  if (sample < 0) sample = -sample;
  sample += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return ulawByte;
}

export interface TwilioMediaMessage {
  event: "connected" | "start" | "media" | "mark" | "clear" | "stop";
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters?: Record<string, string>;
    mediaFormat?: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track?: string;
    chunk?: string;
    timestamp?: string;
    payload: string; // base64-encoded mulaw
  };
  mark?: {
    name: string;
  };
}

export class TelephonyAudioAdapter {
  private streamSid: string | null = null;
  private callSid: string | null = null;

  constructor(streamSid?: string, callSid?: string) {
    if (streamSid) this.streamSid = streamSid;
    if (callSid) this.callSid = callSid;
  }

  getStreamSid(): string | null {
    return this.streamSid;
  }

  getCallSid(): string | null {
    return this.callSid;
  }

  setStreamSid(sid: string): void {
    this.streamSid = sid;
  }

  setCallSid(sid: string): void {
    this.callSid = sid;
  }

  /**
   * Decodes an 8kHz μ-law base64 string from Twilio into a 16kHz 16-bit linear PCM buffer.
   * Steps:
   * 1. base64 decode to 8-bit μ-law bytes
   * 2. Expand μ-law to 16-bit linear PCM (8kHz)
   * 3. Resample 8kHz -> 16kHz via linear interpolation
   */
  decodeUlaw8kToPcm16k(base64Ulaw: string): Buffer {
    const ulawBuffer = Buffer.from(base64Ulaw, "base64");
    const pcm8kLength = ulawBuffer.length;
    // Resample 8k -> 16k doubles the sample count
    const pcm16kLength = pcm8kLength * 2;
    const outputBuffer = Buffer.alloc(pcm16kLength * 2); // 2 bytes per 16-bit sample

    for (let i = 0; i < pcm8kLength; i++) {
      const s0 = ULAW_EXP_TABLE[ulawBuffer[i]];
      const s1 = i + 1 < pcm8kLength ? ULAW_EXP_TABLE[ulawBuffer[i + 1]] : s0;

      // Sample 2*i is exact s0
      outputBuffer.writeInt16LE(s0, (2 * i) * 2);
      // Sample 2*i + 1 is interpolated between s0 and s1
      const interpolated = Math.round((s0 + s1) / 2);
      outputBuffer.writeInt16LE(interpolated, (2 * i + 1) * 2);
    }

    return outputBuffer;
  }

  /**
   * Encodes a 16kHz 16-bit linear PCM buffer into an 8kHz μ-law base64 string for Twilio.
   * Steps:
   * 1. Downsample 16kHz -> 8kHz (decimate 2:1)
   * 2. Compress 16-bit PCM to 8-bit μ-law
   * 3. base64 encode
   */
  encodePcm16kToUlaw8k(pcm16kBuffer: Buffer): string {
    const totalSamples = Math.floor(pcm16kBuffer.length / 2);
    const downsampledLength = Math.floor(totalSamples / 2);
    const ulawBytes = Buffer.alloc(downsampledLength);

    for (let i = 0; i < downsampledLength; i++) {
      // Average 2 consecutive samples for anti-aliasing
      const sample1 = pcm16kBuffer.readInt16LE(i * 4);
      const sample2 = pcm16kBuffer.readInt16LE(i * 4 + 2);
      const avg = Math.round((sample1 + sample2) / 2);
      ulawBytes[i] = linearToUlaw(avg);
    }

    return ulawBytes.toString("base64");
  }

  /**
   * Parse incoming message frame from Twilio Media Stream WebSocket.
   */
  parseMessage(raw: string | Buffer): TwilioMediaMessage | null {
    try {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      const msg = JSON.parse(text) as TwilioMediaMessage;
      if (msg.event === "start" && msg.start) {
        this.streamSid = msg.start.streamSid;
        this.callSid = msg.start.callSid;
      }
      return msg;
    } catch {
      return null;
    }
  }

  /**
   * Creates an outbound media frame to send audio chunks to Twilio.
   */
  createMediaFrame(base64UlawPayload: string): string {
    return JSON.stringify({
      event: "media",
      streamSid: this.streamSid ?? undefined,
      media: {
        payload: base64UlawPayload,
      },
    });
  }

  /**
   * Creates a "clear" frame to immediately clear Twilio's audio buffer (barge-in).
   */
  createClearFrame(): string {
    return JSON.stringify({
      event: "clear",
      streamSid: this.streamSid ?? undefined,
    });
  }

  /**
   * Creates a "mark" frame to track when a specific audio segment has finished playing.
   */
  createMarkFrame(name: string): string {
    return JSON.stringify({
      event: "mark",
      streamSid: this.streamSid ?? undefined,
      mark: {
        name,
      },
    });
  }
}
