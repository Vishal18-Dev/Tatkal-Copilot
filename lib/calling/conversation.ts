"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { CallScript, CallState, CallStep } from "./types";
import type { Trip } from "@/types";
import type { Conversation } from "@/lib/conversation/types";
import { createConversation } from "@/lib/conversation/service";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { isVoiceLang, type VoiceLang } from "@/lib/voice/languages";

export interface CallLine {
  id: string;
  role?: "agent" | "user";
  text: string;
  language?: string;
}

const VAD_RMS_THRESHOLD = 0.005;
const VAD_SILENCE_DURATION_MS = 900;
const VAD_MIN_SPEECH_DURATION_MS = 200;

export function useCallConversation(
  script: CallScript,
  lang: Lang,
  onAction: (action: "open_trip" | "open_plan") => void,
  trip?: Trip | null,
  geolocation?: { latitude: number; longitude: number }
) {
  const [state, setState] = useState<CallState>("idle");
  const [lines, setLines] = useState<CallLine[]>([]);
  const [interimText, setInterimText] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [conversation, setConversation] = useState<Conversation>(() =>
    createConversation({
      channel: "phone",
      language: isVoiceLang(lang) ? lang : "en",
      tripId: trip?.id,
    })
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genRef = useRef(0);
  const activeLangRef = useRef<VoiceLang>(isVoiceLang(lang) ? lang : "en");
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  const tripRef = useRef(trip);
  tripRef.current = trip;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Audio & VAD references
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speechRecRef = useRef<any>(null);
  const speechHandledRef = useRef(false);
  const isProcessingTurnRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const cleanupMic = useCallback(() => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.abort();
      } catch {}
      speechRecRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (vadRafRef.current) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const fullCleanup = useCallback(() => {
    cleanupAudio();
    cleanupMic();
  }, [cleanupAudio, cleanupMic]);

  useEffect(() => fullCleanup, [fullCleanup]);

  /** Halt agent speech immediately (Barge-in) */
  const interrupt = useCallback(() => {
    cleanupAudio();
    setState("interrupted");
    setTimeout(() => {
      setState("listening");
    }, 150);
  }, [cleanupAudio]);

  /** Speak text aloud via Sarvam TTS, then execute callback */
  const speakText = useCallback(
    async (text: string, myGen: number, onFinished?: () => void) => {
      cleanupAudio();
      cleanupMic();
      setState("speaking");
      setInterimText(null);

      try {
        const res = await fetch("/api/calling/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: activeLangRef.current }),
        });
        const data = (await res.json().catch(() => ({}))) as { audioBase64?: string; audioCodec?: string };
        if (myGen !== genRef.current) return;

        if (data.audioBase64) {
          const audio = new Audio(`data:audio/${data.audioCodec ?? "mp3"};base64,${data.audioBase64}`);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        } else {
          // Natural speech delay fallback
          await new Promise((r) => setTimeout(r, Math.min(3200, 800 + text.length * 35)));
        }
      } finally {
        if (myGen === genRef.current) {
          onFinished?.();
        }
      }
    },
    [cleanupAudio, cleanupMic]
  );

  /** Process a completed spoken or typed user turn through Unified Copilot Brain */
  const handleUserTurn = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim();
      if (!trimmed) return;
      if (isProcessingTurnRef.current) return;
      isProcessingTurnRef.current = true;

      try {
        genRef.current += 1;
        const myGen = genRef.current;

        // 1. Add user line to conversation log
        setLines((prev) => [...prev, { id: `line_user_${Date.now()}`, role: "user", text: trimmed }]);
        setInterimText(null);
        setState("thinking");

        // 2. Check farewell
        if (/\b(bye|goodbye|alvida|tata|dhanyawad|shukriya|thanks|exit|quit|stop)\b/i.test(trimmed)) {
          const farewell =
            activeLangRef.current === "hi"
              ? "तत्काल कोपायलट का उपयोग करने के लिए धन्यवाद। शुभ यात्रा!"
              : "Thank you for using Tatkal Copilot. Have a safe journey!";
          setLines((prev) => [...prev, { id: `farewell_${Date.now()}`, role: "agent", text: farewell }]);
          await speakText(farewell, myGen, () => {
            setState("ended");
            cleanupMic();
          });
          return;
        }

        // 3. Execute Copilot Turn
        try {
          const copilotResult = await executeCopilotTurn({
            channel: "phone",
            text: trimmed,
            language: activeLangRef.current,
            trip: tripRef.current ?? undefined,
            conversation: conversationRef.current,
            isUserInitiated: true,
            geolocation,
          });

          if (myGen !== genRef.current) return;

          setConversation(copilotResult.conversation);
          if (copilotResult.trip) {
            tripRef.current = copilotResult.trip;
          }

          const reply = copilotResult.assistantMessage.originalText;
          setLines((prev) => [...prev, { id: `agent_${Date.now()}`, role: "agent", text: reply }]);

          // 4. Speak response, then automatically return to listening (Hands-free loop!)
          await speakText(reply, myGen, () => {
            if (myGen === genRef.current && stateRef.current !== "ended") {
              setState("listening");
            }
          });
        } catch (err) {
          console.warn("[calling/conversation] turn error:", err);
          const fallbackMsg = "I had trouble processing that. Could you repeat?";
          setLines((prev) => [...prev, { id: `err_${Date.now()}`, role: "agent", text: fallbackMsg }]);
          await speakText(fallbackMsg, myGen, () => {
            if (myGen === genRef.current && stateRef.current !== "ended") {
              setState("listening");
            }
          });
        }
      } finally {
        isProcessingTurnRef.current = false;
      }
    },
    [speakText, geolocation, cleanupMic]
  );

  /** Continuous Hands-free Listening loop with Voice Activity Detection (VAD) */
  const startListening = useCallback(async () => {
    try {
      if (isMutedRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("listening");
        return;
      }

      cleanupMic();
      speechHandledRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      audioChunksRef.current = [];
      speechDetectedRef.current = false;
      speechStartTimeRef.current = 0;

      // Web Speech API for instant zero-latency speech recognition if supported
      if (typeof window !== "undefined") {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const sr = new SpeechRec();
            sr.continuous = false;
            sr.interimResults = true;
            sr.lang = activeLangRef.current === "hi" ? "hi-IN" : "en-IN";
            sr.onresult = (ev: any) => {
              const text = Array.from(ev.results)
                .map((r: any) => r[0].transcript)
                .join("");
              if (text.trim()) {
                speechDetectedRef.current = true;
                setInterimText(`Listening: "${text.trim()}"`);
                if (ev.results[0].isFinal) {
                  if (speechHandledRef.current) return;
                  speechHandledRef.current = true;
                  try {
                    sr.stop();
                  } catch {}
                  if (recorderRef.current && recorderRef.current.state === "recording") {
                    recorderRef.current.stop();
                  }
                  void handleUserTurn(text.trim());
                }
              }
            };
            sr.start();
            speechRecRef.current = sr;
          } catch {
            /* ignore browser speech rec errors */
          }
        }
      }

      // Setup VAD AudioContext + Analyser
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (speechHandledRef.current) return;

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0 || !speechDetectedRef.current) {
          if (stateRef.current !== "ended" && !isMutedRef.current) {
            void startListening();
          }
          return;
        }

        speechHandledRef.current = true;

        // Transcribe spoken audio
        setState("thinking");
        try {
          const form = new FormData();
          form.append("audio", blob, "phone_speech.webm");
          form.append("voiceLang", activeLangRef.current);
          const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const data = (await res.json()) as { transcript?: string };
            if (data.transcript?.trim()) {
              void handleUserTurn(data.transcript);
              return;
            }
          }
        } catch {
          // Audio transcribe failed, recover to listening
        }

        if (stateRef.current !== "ended" && !isMutedRef.current) {
          setState("listening");
          void startListening();
        }
      };

      recorder.start(100);
      setState("listening");

      // Realtime VAD loop
      const buffer = new Float32Array(analyser.fftSize);
      const monitorVad = () => {
        if (!analyserRef.current || !recorderRef.current || recorderRef.current.state !== "recording") {
          return;
        }

        analyserRef.current.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        const now = Date.now();
        if (rms >= VAD_RMS_THRESHOLD) {
          // Voice energy detected!
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            speechStartTimeRef.current = now;
            setInterimText("Listening to you...");

            // If audio was currently speaking, trigger barge-in!
            if (audioRef.current && !audioRef.current.paused) {
              interrupt();
            }
          }

          // Clear any pending silence timer while user is speaking
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (speechDetectedRef.current) {
          // User was speaking and is now silent
          const duration = now - speechStartTimeRef.current;
          if (duration >= VAD_MIN_SPEECH_DURATION_MS && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              // End of user turn detected
              if (recorderRef.current && recorderRef.current.state === "recording") {
                recorderRef.current.stop();
              }
            }, VAD_SILENCE_DURATION_MS);
          }
        }

        vadRafRef.current = requestAnimationFrame(monitorVad);
      };

      vadRafRef.current = requestAnimationFrame(monitorVad);
    } catch {
      // Degrade gracefully if microphone blocked
      setState("listening");
    }
  }, [cleanupMic, handleUserTurn, interrupt, state]);

  // Keep continuous hands-free listening active when state === "listening"
  useEffect(() => {
    if (state === "listening" && (!recorderRef.current || recorderRef.current.state === "inactive")) {
      void startListening();
    }
  }, [state, startListening]);

  /** Toggle mute/unmute */
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        cleanupMic();
      } else {
        void startListening();
      }
      return next;
    });
  }, [cleanupMic, startListening]);

  const accept = useCallback(async () => {
    genRef.current += 1;
    const myGen = genRef.current;
    setLines([]);
    setState("connecting");
    await new Promise((r) => setTimeout(r, 400));
    if (myGen !== genRef.current) return;

    // Speak initial briefing / greeting
    const startStep = script.steps.start;
    setLines([{ id: startStep.id, role: "agent", text: startStep.text }]);
    await speakText(startStep.text, myGen, () => {
      // Immediately enter Hands-free Listening mode!
      if (myGen === genRef.current) {
        setState("listening");
        void startListening();
      }
    });
  }, [script, speakText, startListening]);

  const decline = useCallback(() => {
    genRef.current += 1;
    fullCleanup();
    setState("ended");
  }, [fullCleanup]);

  const ring = useCallback(() => setState("ringing"), []);

  return {
    state,
    lines,
    interimText,
    conversation,
    isMuted,
    ring,
    accept,
    decline,
    interrupt,
    toggleMute,
    handleUserTurn,
    startListening,
  };
}
