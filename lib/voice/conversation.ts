"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseVoiceCommand } from "./commands";
import {
  composeAnswer,
  composeGoal,
  parseFollowUp,
  suggestedAdjustments,
  type AdjustmentKind,
} from "./adjustments";
import {
  VOICE_HANDS_FREE_RESUME_MS,
  VOICE_MAX_AUDIO_BYTES,
  VOICE_MAX_RECORDING_MS,
  VOICE_MIN_RECORDING_MS,
  VOICE_REQUEST_TIMEOUT_MS,
  VOICE_VAD_MIN_SPEECH_MS,
  VOICE_VAD_RMS_THRESHOLD,
  VOICE_VAD_SILENCE_MS,
} from "./types";
import { fromBcp47, type VoiceLang } from "./languages";
import type {
  VoiceConversationOptions,
  VoiceErrorKind,
  VoiceRespondResult,
  VoiceState,
  VoiceTurn,
} from "./types";

let turnSeq = 0;
const nextId = () => `turn_${Date.now()}_${turnSeq++}`;

/**
 * Client-side orchestrator for the voice agent: records a clip, sends it to
 * Sarvam STT, and either (a) turns a fresh goal into a plan via the existing
 * planner, or (b) — once a recommendation is on screen — classifies the next
 * utterance as confirm/reject/repeat/cancel. Nothing here talks to booking
 * logic directly; on confirmation it just hands the goal + plan back to the
 * caller (VoicePanel), which routes into the real /app/plan wizard. Search
 * this file for "onConfirm" — that is the ONLY way state leaves this module,
 * and it is a plain callback, not a call into the booking agent or store.
 */
export function useVoiceConversation({
  voiceLang,
  locked = false,
  continuous = false,
  onConfirm,
  onDetectLang,
}: VoiceConversationOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorKind, setErrorKind] = useState<VoiceErrorKind | null>(null);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [result, setResult] = useState<VoiceRespondResult | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  // Hands-free: the mic stays open across turns until the user pauses it.
  const [paused, setPaused] = useState(false);

  const goalRef = useRef<string>("");
  const resultRef = useRef<VoiceRespondResult | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartRef = useRef(0);
  // Bumped on every cancel/reset so an in-flight fetch that resolves late
  // knows its result is stale and must not overwrite newer UI state.
  const requestGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // The language the agent actually responds in. Held in a ref (not the
  // voiceLang prop) so a language DETECTED mid-turn takes effect on the very
  // same turn's response, instead of waiting a render for the prop to catch up.
  const activeLangRef = useRef<VoiceLang>(voiceLang);
  useEffect(() => {
    activeLangRef.current = voiceLang;
  }, [voiceLang]);

  // Hands-free / voice-activity-detection state.
  const continuousRef = useRef(continuous);
  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);
  const pausedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const speechStartRef = useRef(0);
  const silenceStartRef = useRef(0);

  useEffect(() => {
    setMicSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined" &&
        (typeof window === "undefined" || window.isSecureContext)
    );
    return () => {
      cleanupMedia();
      abortRef.current?.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  function teardownVad() {
    if (vadRafRef.current != null) cancelAnimationFrame(vadRafRef.current);
    vadRafRef.current = null;
    // Closing the AudioContext is async and best-effort — ignore failures.
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    speechDetectedRef.current = false;
    speechStartRef.current = 0;
    silenceStartRef.current = 0;
  }

  function cleanupMedia() {
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    maxDurationTimerRef.current = null;
    elapsedTimerRef.current = null;
    teardownVad();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    audioElRef.current?.pause();
    audioElRef.current = null;
  }

  /**
   * Voice-activity detection: watch the mic level and auto-end the turn after a
   * short trailing silence once the user has actually spoken. Best-effort — if
   * the Web Audio API is missing, hands-free silently degrades to the max-
   * duration auto-stop and the manual stop button.
   */
  function setupVad(stream: MediaStream, onSilence: () => void) {
    try {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      speechDetectedRef.current = false;
      speechStartRef.current = Date.now();
      silenceStartRef.current = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        const now = Date.now();

        if (rms > VOICE_VAD_RMS_THRESHOLD) {
          if (!speechDetectedRef.current) speechStartRef.current = now;
          speechDetectedRef.current = true;
          silenceStartRef.current = 0;
        } else if (speechDetectedRef.current && now - speechStartRef.current > VOICE_VAD_MIN_SPEECH_MS) {
          if (silenceStartRef.current === 0) silenceStartRef.current = now;
          else if (now - silenceStartRef.current > VOICE_VAD_SILENCE_MS) {
            teardownVad();
            onSilence();
            return;
          }
        }
        vadRafRef.current = requestAnimationFrame(tick);
      };
      vadRafRef.current = requestAnimationFrame(tick);
    } catch {
      /* VAD unavailable — hands-free falls back to manual/max-duration stop */
    }
  }

  const pushTurn = useCallback((role: VoiceTurn["role"], text: string, final = true) => {
    setTurns((t) => [...t, { id: nextId(), role, text, final }]);
  }, []);

  const fail = useCallback((kind: VoiceErrorKind) => {
    setErrorKind(kind);
    setState("error");
  }, []);

  /** Start recording a clip from the mic. Auto-stops at VOICE_MAX_RECORDING_MS. */
  const start = useCallback(async () => {
    setErrorKind(null);
    if (!micSupported) {
      fail("mic_unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      fail(name === "NotAllowedError" || name === "SecurityError" ? "mic_permission_denied" : "recording_error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
      typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(m) : false
    );

    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      cleanupMedia();
      fail("recording_error");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
    recordStartRef.current = Date.now();
    setElapsedMs(0);
    setState("listening");

    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - recordStartRef.current);
    }, 200);
    // Never let an accidentally-open mic keep recording indefinitely.
    maxDurationTimerRef.current = setTimeout(() => {
      void stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, VOICE_MAX_RECORDING_MS);

    // Hands-free: end the turn on a trailing silence instead of a tap.
    if (continuousRef.current) {
      setupVad(stream, () => {
        void stop();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micSupported]);

  /** Stop recording, transcribe, and route the transcript appropriately. */
  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const myGen = requestGenRef.current;

    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    const durationMs = Date.now() - recordStartRef.current;

    setState("transcribing");
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (myGen !== requestGenRef.current) return; // cancelled while wrapping up

    if (durationMs < VOICE_MIN_RECORDING_MS) {
      fail("recording_too_short");
      return;
    }

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
    if (blob.size === 0) {
      fail("recording_too_short");
      return;
    }
    if (blob.size > VOICE_MAX_AUDIO_BYTES) {
      fail("recording_too_long");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);

    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      form.append("voiceLang", voiceLang);
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (myGen !== requestGenRef.current) return; // stale — user already cancelled/reset

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { errorKind?: VoiceErrorKind };
        fail(body.errorKind ?? "stt_error");
        return;
      }
      const data = (await res.json()) as { transcript: string; languageCode?: string | null };
      const text = data.transcript?.trim();

      if (!text) {
        fail("stt_error");
        return;
      }

      // Follow the speaker's detected language (unless they've locked one).
      // Set the active response language NOW so this turn's reply is spoken back
      // in the language they actually used — not the one the selector shows.
      if (data.languageCode) {
        const detected = fromBcp47(data.languageCode);
        if (detected && !locked) activeLangRef.current = detected;
        onDetectLang?.(data.languageCode);
      }
      pushTurn("user", text);

      if (!resultRef.current) {
        await requestPlan(text, myGen);
      } else {
        await handleFollowUp(text, myGen);
      }
    } catch (err) {
      if (myGen !== requestGenRef.current) return;
      fail(controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError") ? "timeout" : "network_error");
    } finally {
      clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceLang, locked, pushTurn, onDetectLang]);

  const requestPlan = useCallback(
    async (goal: string, myGen: number) => {
      goalRef.current = goal;
      setState("thinking");
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch("/api/voice/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: goal, voiceLang: activeLangRef.current }),
          signal: controller.signal,
        });
        if (myGen !== requestGenRef.current) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { errorKind?: VoiceErrorKind };
          fail(body.errorKind ?? "planner_error");
          return;
        }
        const data = (await res.json()) as VoiceRespondResult;
        if (myGen !== requestGenRef.current) return;
        resultRef.current = data;
        setResult(data);
        pushTurn("agent", data.responseText);
        await speak(data, myGen);
      } catch (err) {
        if (myGen !== requestGenRef.current) return;
        fail(
          controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")
            ? "timeout"
            : "network_error"
        );
      } finally {
        clearTimeout(timer);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceLang, pushTurn]
  );

  /** TTS is best-effort: a playback failure still leaves the text result on screen. */
  const speak = useCallback(async (data: VoiceRespondResult, myGen: number) => {
    if (!data.audioBase64) {
      if (myGen === requestGenRef.current) setState("result");
      return;
    }
    try {
      setState("speaking");
      const audio = new Audio(`data:audio/${data.audioCodec ?? "mp3"};base64,${data.audioBase64}`);
      audioElRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve(); // tts_error is non-fatal — see spec §24
        audio.play().catch(() => resolve());
      });
    } finally {
      if (myGen === requestGenRef.current) setState("result");
    }
  }, []);

  const replay = useCallback(() => {
    if (resultRef.current) void speak(resultRef.current, requestGenRef.current);
  }, [speak]);

  /** Interrupt TTS playback early (e.g. user taps the mic while it's speaking). */
  const stopSpeaking = useCallback(() => {
    audioElRef.current?.pause();
    if (resultRef.current) setState("result");
  }, []);

  /**
   * Voice one grounded line the client composed (in English) — the speak route
   * renders it into the active language, and we show THAT translated text in
   * the transcript so the words on screen match the words spoken. Best-effort:
   * translation/TTS failure falls back to the English text, caption-only.
   */
  const respondLine = useCallback(
    async (english: string, myGen: number) => {
      setState("speaking");
      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: english, voiceLang: activeLangRef.current }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          text?: string;
          audioBase64?: string;
          audioCodec?: string;
        };
        if (myGen !== requestGenRef.current) return;
        pushTurn("agent", data.text ?? english);
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/${data.audioCodec ?? "mp3"};base64,${data.audioBase64}`);
          audioElRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        }
      } finally {
        if (myGen === requestGenRef.current) setState("result");
      }
    },
    [voiceLang, pushTurn]
  );

  /** Answer a spoken question from grounded plan data, staying on the pick. */
  const answerQuestion = useCallback(
    async (question: string, myGen: number) => {
      const r = resultRef.current;
      if (!r) return;
      // Compose in English; respondLine translates for display + TTS.
      const answer = composeAnswer(r.plan, r.recommended, question, "en");
      await respondLine(answer, myGen);
    },
    [respondLine]
  );

  /** Apply an adjustment by recomposing the goal and re-running the planner. */
  const applyAdjustment = useCallback(
    async (adjustment: AdjustmentKind, myGen: number) => {
      const r = resultRef.current;
      if (!r) return;
      const goal = composeGoal(r.plan.intent, adjustment);
      await requestPlan(goal, myGen); // re-plans + speaks the new recommendation
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceLang]
  );

  const handleFollowUp = useCallback(
    async (text: string, myGen: number) => {
      const cmd = parseVoiceCommand(text);
      if (cmd.kind === "confirm") {
        confirmByTap();
        return;
      }
      if (cmd.kind === "reject") {
        reset();
        return;
      }
      if (cmd.kind === "cancel") {
        cancel();
        return;
      }
      if (cmd.kind === "repeat" && resultRef.current) {
        pushTurn("agent", resultRef.current.responseText);
        await speak(resultRef.current, myGen);
        return;
      }

      // Not a command — is it an adjustment (re-plan) or a question (answer)?
      const fu = parseFollowUp(text);
      if (fu.kind === "adjust" && fu.adjustment) {
        await applyAdjustment(fu.adjustment, myGen);
      } else if (fu.kind === "question") {
        await answerQuestion(text, myGen);
      } else {
        // Truly unrecognized — stay on the pick, don't guess (spec §11).
        if (myGen === requestGenRef.current) setState("result");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyAdjustment, answerQuestion]
  );

  /** Tap equivalents (accessibility + reliable in every environment). */
  const tapAdjustment = useCallback(
    (adjustment: AdjustmentKind) => {
      const myGen = requestGenRef.current;
      void applyAdjustment(adjustment, myGen);
    },
    [applyAdjustment]
  );

  const askByTap = useCallback(
    (question: string) => {
      const myGen = requestGenRef.current;
      pushTurn("user", question);
      void answerQuestion(question, myGen);
    },
    [answerQuestion, pushTurn]
  );

  const confirmByTap = useCallback(() => {
    if (!resultRef.current) return;
    setState("confirming");
    onConfirm(goalRef.current, resultRef.current.plan);
  }, [onConfirm]);

  const rejectByTap = useCallback(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** User-initiated stop: abandon everything in flight, back to idle. */
  const cancel = useCallback(() => {
    requestGenRef.current += 1;
    abortRef.current?.abort();
    cleanupMedia();
    fail("cancelled");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    requestGenRef.current += 1;
    abortRef.current?.abort();
    cleanupMedia();
    goalRef.current = "";
    resultRef.current = null;
    setResult(null);
    setTurns([]);
    setErrorKind(null);
    setElapsedMs(0);
    setState("idle");
  }, []);

  /** Hands-free: temporarily stop listening (mute) without leaving the surface. */
  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    requestGenRef.current += 1; // drop anything in flight
    abortRef.current?.abort();
    cleanupMedia();
    setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Hands-free: resume listening after a pause. */
  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    void start();
  }, [start]);

  const togglePause = useCallback(() => {
    if (pausedRef.current) resume();
    else pause();
  }, [pause, resume]);

  // Hands-free loop: open the mic when the surface first settles (idle) and
  // re-open it after each reply (result) — unless the user has paused it. The
  // effect's cleanup cancels the pending timer, so React StrictMode's dev
  // double-invoke can't double-open the mic.
  useEffect(() => {
    if (!continuous || pausedRef.current) return;
    if (state !== "result" && state !== "idle") return;
    const timer = setTimeout(
      () => {
        if (continuousRef.current && !pausedRef.current) void start();
      },
      state === "idle" ? 250 : VOICE_HANDS_FREE_RESUME_MS
    );
    return () => clearTimeout(timer);
  }, [state, continuous, start]);

  // Adjustment chips reflect the current recommendation (e.g. offer a class
  // switch that isn't the current class).
  const adjustments = useMemo(
    () => (result ? suggestedAdjustments(result.plan, result.recommended) : []),
    [result]
  );

  return {
    state,
    errorKind,
    turns,
    result,
    adjustments,
    micSupported,
    elapsedMs,
    maxRecordingMs: VOICE_MAX_RECORDING_MS,
    continuous,
    paused,
    start,
    stop,
    cancel,
    pause,
    resume,
    togglePause,
    confirmByTap,
    rejectByTap,
    tapAdjustment,
    askByTap,
    replay,
    stopSpeaking,
    reset,
  };
}
