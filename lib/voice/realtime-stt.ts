"use client";

import type { VoiceLang } from "./languages";

export interface RealtimeSTTOptions {
  language: VoiceLang;
  onInterim: (text: string) => void;
  onFinal: (text: string, languageCode?: string) => void;
  onError: (error: Error) => void;
}

export class RealtimeSTTClient {
  private sessionId: string;
  private options: RealtimeSTTOptions;
  private eventSource: EventSource | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private active = false;

  constructor(options: RealtimeSTTOptions) {
    this.sessionId = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.options = options;
  }

  async start(stream: MediaStream): Promise<void> {
    this.active = true;

    // 1. Establish SSE listener with server bridge
    const sseUrl = `/api/voice/realtime-stream?sessionId=${encodeURIComponent(
      this.sessionId
    )}&lang=${encodeURIComponent(this.options.language)}`;

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;
      const es = new EventSource(sseUrl);
      this.eventSource = es;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          es.close();
          reject(new Error("Realtime connection timeout"));
        }
      }, 4000);

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "connected") {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              resolve();
            }
          } else if (data.type === "interim") {
            if (data.text) this.options.onInterim(data.text);
          } else if (data.type === "final") {
            if (data.text) this.options.onFinal(data.text, data.languageCode);
          } else if (data.type === "error") {
            const err = new Error(data.error || "Realtime STT error");
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              reject(err);
            } else {
              this.options.onError(err);
            }
          }
        } catch {
          /* ignore json parse errors */
        }
      };

      es.onerror = (e) => {
        const err = new Error("Realtime STT bridge disconnected");
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          reject(err);
        } else {
          this.options.onError(err);
        }
        this.cleanup();
      };
    });

    // 2. Setup AudioContext & capture 16kHz PCM chunks
    try {
      const AudioContextClass =
        (typeof window !== "undefined"
          ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined) || (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!AudioContextClass) throw new Error("AudioContext unsupported");

      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });
      this.mediaStreamSource = this.audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor to grab raw PCM buffers (bufferSize 4096 = ~250ms chunks at 16kHz)
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        if (!this.active) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        void this.sendChunk(base64Audio);
      };

      this.mediaStreamSource.connect(this.processor);
      this.processor.connect(this.audioCtx.destination);
    } catch (err) {
      this.cleanup();
      throw err;
    }
  }

  private async sendChunk(base64Audio: string): Promise<void> {
    if (!this.active) return;
    try {
      await fetch("/api/voice/realtime-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          audio: base64Audio,
        }),
      });
    } catch {
      /* best-effort transmission */
    }
  }

  async stop(): Promise<void> {
    this.active = false;
    try {
      await fetch("/api/voice/realtime-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          isFinal: true,
        }),
      });
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  abort(): void {
    this.active = false;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
