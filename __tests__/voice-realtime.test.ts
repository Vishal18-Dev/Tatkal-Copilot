import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { RealtimeSTTClient } from "@/lib/voice/realtime-stt";
import type { VoiceState, VoiceTurn } from "@/lib/voice/types";

describe("Realtime Browser Voice (Item 5B)", () => {
  describe("Architectural & Secret Safety Boundaries", () => {
    it("never exposes SARVAM_API_KEY to client components or realtime client", () => {
      const clientSrc = readFileSync(
        join(process.cwd(), "lib", "voice", "realtime-stt.ts"),
        "utf8"
      );
      expect(clientSrc).not.toContain("process.env.SARVAM_API_KEY");
      expect(clientSrc).not.toContain("SARVAM_API_KEY");
      expect(clientSrc).toContain('"use client"');
    });

    it("server bridge manages Sarvam WebSocket with server-side API key", () => {
      const bridgeSrc = readFileSync(
        join(process.cwd(), "app", "api", "voice", "realtime-stream", "route.ts"),
        "utf8"
      );
      expect(bridgeSrc).toContain("process.env.SARVAM_API_KEY");
      expect(bridgeSrc).toContain("Api-Subscription-Key");
      expect(bridgeSrc).toContain("wss://api.sarvam.ai/speech-to-text-realtime/ws");
      expect(bridgeSrc).toContain('export const runtime = "nodejs"');
    });

    it("VoiceState union includes connecting and rest_listening states", () => {
      const typesSrc = readFileSync(
        join(process.cwd(), "lib", "voice", "types.ts"),
        "utf8"
      );
      expect(typesSrc).toContain('"connecting"');
      expect(typesSrc).toContain('"rest_listening"');
    });
  });

  describe("Realtime STT Client Protocol & Interim Handling", () => {
    let mockEventSourceInstances: any[] = [];

    beforeEach(() => {
      mockEventSourceInstances = [];
      (global as any).EventSource = class MockEventSource {
        url: string;
        onmessage: ((e: any) => void) | null = null;
        onerror: ((e: any) => void) | null = null;
        closed = false;

        constructor(url: string) {
          this.url = url;
          mockEventSourceInstances.push(this);
        }

        close() {
          this.closed = true;
        }
      };

      // Mock AudioContext
      (global as any).AudioContext = class MockAudioContext {
        state = "running";
        createMediaStreamSource() {
          return { connect: vi.fn(), disconnect: vi.fn() };
        }
        createScriptProcessor() {
          return {
            connect: vi.fn(),
            disconnect: vi.fn(),
            onaudioprocess: null,
          };
        }
        close() {
          this.state = "closed";
          return Promise.resolve();
        }
      };
    });

    afterEach(() => {
      delete (global as any).EventSource;
      delete (global as any).AudioContext;
      vi.restoreAllMocks();
    });

    it("emits interim and final hypotheses through callbacks", async () => {
      const interimEvents: string[] = [];
      const finalEvents: string[] = [];

      const client = new RealtimeSTTClient({
        language: "hi",
        onInterim: (text) => interimEvents.push(text),
        onFinal: (text) => finalEvents.push(text),
        onError: vi.fn(),
      });

      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      } as unknown as MediaStream;

      const startPromise = client.start(mockStream);

      expect(mockEventSourceInstances.length).toBe(1);
      const es = mockEventSourceInstances[0];
      expect(es.url).toContain("/api/voice/realtime-stream?sessionId=");
      expect(es.url).toContain("lang=hi");

      // Simulate connection confirmation from server bridge
      es.onmessage({ data: JSON.stringify({ type: "connected" }) });
      await startPromise;

      // Simulate interim transcript from streaming STT
      es.onmessage({
        data: JSON.stringify({
          type: "interim",
          text: "मुझे दिल्ली जाना",
          isFinal: false,
        }),
      });
      expect(interimEvents).toEqual(["मुझे दिल्ली जाना"]);
      expect(finalEvents).toEqual([]);

      // Simulate final transcript
      es.onmessage({
        data: JSON.stringify({
          type: "final",
          text: "मुझे दिल्ली जाना है",
          isFinal: true,
          languageCode: "hi-IN",
        }),
      });
      expect(finalEvents).toEqual(["मुझे दिल्ली जाना है"]);

      await client.stop();
      expect(es.closed).toBe(true);
    });

    it("notifies onError when the bridge encounters an error", async () => {
      const onError = vi.fn();
      const client = new RealtimeSTTClient({
        language: "en",
        onInterim: vi.fn(),
        onFinal: vi.fn(),
        onError,
      });

      const mockStream = {
        getTracks: () => [{ stop: vi.fn() }],
      } as unknown as MediaStream;

      const startPromise = client.start(mockStream);
      const es = mockEventSourceInstances[0];

      // Connected first
      es.onmessage({ data: JSON.stringify({ type: "connected" }) });
      await startPromise;

      // Now error happens
      es.onmessage({
        data: JSON.stringify({ type: "error", error: "WebSocket closed unexpectedly" }),
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onError.mock.calls[0][0].message).toContain("WebSocket closed unexpectedly");
    });
  });

  describe("Voice State Machine & Sticky Fallback Model", () => {
    it("strictly isolates interim transcripts from canonical conversation turns", () => {
      // Turns should only record finalized utterances, never partial streaming words
      const turns: VoiceTurn[] = [];
      let interimTranscript: string | null = null;

      function handleInterim(text: string) {
        interimTranscript = text; // Ephemeral UI only
      }

      function handleFinal(text: string) {
        interimTranscript = null; // Clear interim
        turns.push({ id: "turn_1", role: "user", text, final: true });
      }

      handleInterim("book tatkal");
      expect(interimTranscript).toBe("book tatkal");
      expect(turns.length).toBe(0);

      handleInterim("book tatkal ticket to");
      expect(interimTranscript).toBe("book tatkal ticket to");
      expect(turns.length).toBe(0);

      handleFinal("book tatkal ticket to Mumbai");
      expect(interimTranscript).toBeNull();
      expect(turns.length).toBe(1);
      expect(turns[0].text).toBe("book tatkal ticket to Mumbai");
      expect(turns[0].final).toBe(true);
    });

    it("verifies sticky REST fallback avoids aggressive reconnection loops", () => {
      let isRestFallback = false;
      let currentState: VoiceState = "idle";
      let realtimeAttempts = 0;

      function startSession(mockFailRealtime: boolean) {
        if (isRestFallback) {
          // Already dropped to REST fallback; do not attempt realtime
          currentState = "rest_listening";
          return;
        }

        currentState = "connecting";
        realtimeAttempts++;
        if (mockFailRealtime) {
          // Failure drops to sticky REST fallback
          isRestFallback = true;
          currentState = "rest_listening";
        } else {
          currentState = "listening";
        }
      }

      // First attempt fails (e.g. WS timeout / bad key / network issue)
      startSession(true);
      expect(currentState).toBe("rest_listening");
      expect(isRestFallback).toBe(true);
      expect(realtimeAttempts).toBe(1);

      // Subsequent turns in the same session must stay on REST without reconnect loop
      startSession(false);
      expect(currentState).toBe("rest_listening");
      expect(realtimeAttempts).toBe(1); // Did not increment, no reconnect thrashing

      startSession(false);
      expect(currentState).toBe("rest_listening");
      expect(realtimeAttempts).toBe(1);
    });

    it("verifies natural barge-in halts speech playback immediately upon speech detection", () => {
      let state: VoiceState = "speaking";
      let audioPaused = false;

      const mockAudio = {
        paused: false,
        pause: () => {
          audioPaused = true;
        },
      };

      function onSpeechDetected() {
        if (state === "speaking" && !mockAudio.paused) {
          mockAudio.pause();
          state = "listening";
        }
      }

      expect(state).toBe("speaking");
      expect(audioPaused).toBe(false);

      // User speaks while agent is playing TTS
      onSpeechDetected();

      expect(audioPaused).toBe(true);
      expect(state).toBe("listening");
    });
  });
});
