import type { VoiceLang } from "./languages";
import { bcp47For } from "./languages";

export type SpeechCancelReason =
  | "barge_in"
  | "language_switch"
  | "new_turn"
  | "teardown"
  | "error";

export interface VoiceInstrumentation {
  sessionId: string;
  speechGeneration: number;
  activeTTSRequestId: string | null;
  conversationLanguage: string;
  detectedLanguage: string | null;
  targetLanguage: string | null;
  voiceState: string;
  audioQueueLength: number;
  activePlayback: boolean;
  activeRequestCount: number;
  activePlaybackCount: number;
  lastCancelReason: string | null;
  timestamp: number;
}

export interface SpeechLifecycleController {
  readonly sessionId: string;
  readonly speechGeneration: number;
  readonly activeTTSRequestId: string | null;
  readonly isSpeaking: boolean;
  conversationLanguage: VoiceLang;
  detectedLanguage: string | null;
  targetLanguage: string | null;
  voiceState: string;

  cancelSpeech(reason: SpeechCancelReason): number;
  startSpeechRequest(reason?: string): { generation: number; requestId: string; signal: AbortSignal };
  isGenerationActive(gen: number): boolean;
  validateGeneration(gen: number): boolean;
  playAudioBase64(
    audioBase64: string,
    codec: string,
    generation: number,
    onEnded?: () => void
  ): Promise<boolean>;
  playBrowserSpeech(
    text: string,
    langCode: VoiceLang,
    generation: number,
    onEnded?: () => void
  ): Promise<boolean>;
  getInstrumentation(): VoiceInstrumentation;
  destroy(): void;
}

export function createSpeechLifecycle(
  sessionId: string = `voice_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  initialLang: VoiceLang = "en"
): SpeechLifecycleController {
  let generation = 0;
  let activeTTSRequestId: string | null = null;
  let activeAbortController: AbortController | null = null;
  let activeAudioElement: HTMLAudioElement | null = null;
  let isSpeaking = false;
  let activePlayback = false;
  let activeRequestCount = 0;
  let lastCancelReason: string | null = null;

  let conversationLanguage: VoiceLang = initialLang;
  let detectedLanguage: string | null = null;
  let targetLanguage: string | null = null;
  let voiceState = "idle";

  function syncInstrumentation() {
    if (typeof window !== "undefined") {
      const data: VoiceInstrumentation = {
        sessionId,
        speechGeneration: generation,
        activeTTSRequestId,
        conversationLanguage,
        detectedLanguage,
        targetLanguage,
        voiceState,
        audioQueueLength: 0,
        activePlayback,
        activeRequestCount,
        activePlaybackCount: activePlayback ? 1 : 0,
        lastCancelReason,
        timestamp: Date.now(),
      };
      (window as any).__TATKAL_VOICE_INSTRUMENTATION__ = data;
    }
  }

  function cancelSpeech(reason: SpeechCancelReason): number {
    generation += 1;
    const newGen = generation;
    lastCancelReason = reason;

    if (process.env.NODE_ENV !== "production") {
      console.debug("[SpeechLifecycle] cancelSpeech", {
        sessionId,
        reason,
        invalidatedToGeneration: newGen,
        previousTTSRequestId: activeTTSRequestId,
      });
    }

    activeTTSRequestId = null;
    activeRequestCount = 0;

    // 1. Abort any in-flight network request
    if (activeAbortController) {
      try {
        activeAbortController.abort();
      } catch {}
      activeAbortController = null;
    }

    // 2. Halt and clean up active HTML audio element immediately
    if (activeAudioElement) {
      try {
        activeAudioElement.pause();
        activeAudioElement.currentTime = 0;
        activeAudioElement.src = "";
      } catch {}
      activeAudioElement = null;
    }

    // 3. Cancel browser speechSynthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    isSpeaking = false;
    activePlayback = false;
    syncInstrumentation();

    return newGen;
  }

  function startSpeechRequest(reason = "new_speech_request"): {
    generation: number;
    requestId: string;
    signal: AbortSignal;
  } {
    // Invariant: At most ONE TTS generation may be active at any time
    cancelSpeech("new_turn");
    const reqGen = generation;
    const reqId = `tts_${sessionId}_g${reqGen}_${Date.now()}`;
    activeTTSRequestId = reqId;

    const controller = new AbortController();
    activeAbortController = controller;
    activeRequestCount = 1;
    isSpeaking = true;
    syncInstrumentation();

    return {
      generation: reqGen,
      requestId: reqId,
      signal: controller.signal,
    };
  }

  function isGenerationActive(gen: number): boolean {
    return gen === generation;
  }

  async function playAudioBase64(
    audioBase64: string,
    codec: string,
    reqGen: number,
    onEnded?: () => void
  ): Promise<boolean> {
    // Invariant: Discard stale generation chunks immediately
    if (!isGenerationActive(reqGen) || !audioBase64) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[SpeechLifecycle] Discarding audio chunk for stale generation:", {
          chunkGen: reqGen,
          currentGen: generation,
        });
      }
      return false;
    }

    // Stop any lingering audio element
    if (activeAudioElement) {
      try {
        activeAudioElement.pause();
        activeAudioElement.src = "";
      } catch {}
      activeAudioElement = null;
    }

    const effectiveCodec = codec === "mp3" || !codec ? "mpeg" : codec;
    const audio = new Audio(`data:audio/${effectiveCodec};base64,${audioBase64}`);
    activeAudioElement = audio;
    activePlayback = true;
    isSpeaking = true;
    syncInstrumentation();

    return new Promise<boolean>((resolve) => {
      let settled = false;

      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener("ended", onEnd);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("error", onError);
        audio.removeEventListener("abort", onAbort);

        if (activeAudioElement === audio) {
          activeAudioElement = null;
          activePlayback = false;
        }

        if (isGenerationActive(reqGen)) {
          isSpeaking = false;
          syncInstrumentation();
          if (success) {
            onEnded?.();
          }
        }
        resolve(success && isGenerationActive(reqGen));
      };

      const onEnd = () => finish(true);
      const onError = () => finish(false);
      const onAbort = () => finish(false);
      const onPause = () => {
        // In HTML5 media specification, reaching end of audio dispatches 'pause' before 'ended'.
        // If the audio has ended or reached near duration, this is a natural successful completion.
        if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.2)) {
          finish(true);
          return;
        }
        // If paused by cancellation or teardown
        if (!isGenerationActive(reqGen)) {
          finish(false);
        }
      };

      audio.addEventListener("ended", onEnd);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("error", onError);
      audio.addEventListener("abort", onAbort);

      if (!isGenerationActive(reqGen)) {
        finish(false);
        return;
      }

      audio.play().catch(() => finish(false));
    });
  }

  async function playBrowserSpeech(
    text: string,
    langCode: VoiceLang,
    reqGen: number,
    onEnded?: () => void
  ): Promise<boolean> {
    if (!isGenerationActive(reqGen) || !text.trim()) return false;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const targetBcp = bcp47For(langCode);
      utter.lang = targetBcp;
      utter.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matched = voices.find(
        (v) => v.lang === targetBcp || v.lang.startsWith(targetBcp.split("-")[0])
      );
      if (matched) utter.voice = matched;

      activePlayback = true;
      isSpeaking = true;
      syncInstrumentation();

      return new Promise<boolean>((resolve) => {
        let settled = false;

        const finish = (success: boolean) => {
          if (settled) return;
          settled = true;
          activePlayback = false;
          if (isGenerationActive(reqGen)) {
            isSpeaking = false;
            syncInstrumentation();
            if (success) {
              onEnded?.();
            }
          }
          resolve(success && isGenerationActive(reqGen));
        };

        const timerId = setTimeout(() => finish(true), Math.min(8000, 1200 + text.length * 35));
        utter.onend = () => {
          clearTimeout(timerId);
          finish(true);
        };
        utter.onerror = () => {
          clearTimeout(timerId);
          finish(false);
        };

        if (!isGenerationActive(reqGen)) {
          clearTimeout(timerId);
          finish(false);
          return;
        }

        window.speechSynthesis.speak(utter);
      });
    } catch {
      return false;
    }
  }

  function getInstrumentation(): VoiceInstrumentation {
    return {
      sessionId,
      speechGeneration: generation,
      activeTTSRequestId,
      conversationLanguage,
      detectedLanguage,
      targetLanguage,
      voiceState,
      audioQueueLength: 0,
      activePlayback,
      activeRequestCount,
      activePlaybackCount: activePlayback ? 1 : 0,
      lastCancelReason,
      timestamp: Date.now(),
    };
  }

  function destroy(): void {
    cancelSpeech("teardown");
  }

  // Initial sync
  syncInstrumentation();

  return {
    get sessionId() {
      return sessionId;
    },
    get speechGeneration() {
      return generation;
    },
    get activeTTSRequestId() {
      return activeTTSRequestId;
    },
    get isSpeaking() {
      return isSpeaking;
    },
    get conversationLanguage() {
      return conversationLanguage;
    },
    set conversationLanguage(lang: VoiceLang) {
      conversationLanguage = lang;
      syncInstrumentation();
    },
    get detectedLanguage() {
      return detectedLanguage;
    },
    set detectedLanguage(lang: string | null) {
      detectedLanguage = lang;
      syncInstrumentation();
    },
    get targetLanguage() {
      return targetLanguage;
    },
    set targetLanguage(lang: string | null) {
      targetLanguage = lang;
      syncInstrumentation();
    },
    get voiceState() {
      return voiceState;
    },
    set voiceState(state: string) {
      voiceState = state;
      syncInstrumentation();
    },
    cancelSpeech,
    startSpeechRequest,
    isGenerationActive,
    validateGeneration: isGenerationActive,
    playAudioBase64,
    playBrowserSpeech,
    getInstrumentation,
    destroy,
  };
}
