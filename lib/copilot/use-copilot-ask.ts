"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceLang } from "@/lib/voice/voice-lang";
import {
  VOICE_MAX_AUDIO_BYTES,
  VOICE_MAX_RECORDING_MS,
  VOICE_MIN_RECORDING_MS,
  VOICE_REQUEST_TIMEOUT_MS,
} from "@/lib/voice/types";
import { answerWithTools } from "./router";
import type { CopilotContext } from "./types";

/* ============================================================
   useCopilotAsk — contextual Q&A over a REAL journey.

   The same brain as browser voice, pointed at a live Trip: a
   question routes through the Copilot tools (grounded, read-only),
   the English answer is translated + voiced in the active language,
   and both sides land in a small transcript. Type/tap always work;
   the mic is best-effort and degrades to text on any failure
   (spec §27). Nothing here books or mutates — answers only.
   ============================================================ */

export interface CopilotTurn {
  id: string;
  role: "user" | "agent";
  text: string;
}

export type AskState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

let seq = 0;
const nextId = () => `ask_${Date.now()}_${seq++}`;

const FALLBACK =
  "I can tell you about your journey, the recommended train, your backup, readiness, wallet, or booking status.";

export function useCopilotAsk(getContext: () => CopilotContext) {
  const { voiceLang, observeDetected } = useVoiceLang();
  const [state, setState] = useState<AskState>("idle");
  const [turns, setTurns] = useState<CopilotTurn[]>([]);
  const [micSupported, setMicSupported] = useState(false);
  const [micError, setMicError] = useState(false);

  const genRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMicSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined" &&
        (typeof window === "undefined" || window.isSecureContext)
    );
    return () => cleanup();
  }, []);

  function cleanup() {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
  }

  const push = useCallback((role: CopilotTurn["role"], text: string) => {
    setTurns((t) => [...t, { id: nextId(), role, text }]);
  }, []);

  /** Voice one English line into the active language; show the translated text. */
  const respond = useCallback(
    async (english: string, myGen: number) => {
      setState("speaking");
      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: english, voiceLang }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          text?: string;
          audioBase64?: string;
          audioCodec?: string;
        };
        if (myGen !== genRef.current) return;
        push("agent", data.text ?? english);
        if (data.audioBase64) {
          const audio = new Audio(`data:audio/${data.audioCodec ?? "mp3"};base64,${data.audioBase64}`);
          audioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        }
      } finally {
        if (myGen === genRef.current) setState("idle");
      }
    },
    [voiceLang, push]
  );

  /** Answer a typed/tapped/spoken question from the Copilot tools. */
  const ask = useCallback(
    async (question: string, opts?: { alreadyPushed?: boolean }) => {
      const q = question.trim();
      if (!q) return;
      const myGen = genRef.current;
      if (!opts?.alreadyPushed) push("user", q);
      setState("thinking");
      const routed = answerWithTools(q, getContext());
      const english = routed?.result.speak ?? FALLBACK;
      await respond(english, myGen);
    },
    [getContext, push, respond]
  );

  /** Start a mic capture; on stop it transcribes then asks. Best-effort. */
  const askSpoken = useCallback(async () => {
    setMicError(false);
    if (!micSupported) {
      setMicError(true);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError(true);
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
      cleanup();
      setMicError(true);
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorderRef.current = recorder;
    recorder.start();
    startRef.current = Date.now();
    setState("listening");
    maxTimerRef.current = setTimeout(() => void stopSpoken(), VOICE_MAX_RECORDING_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micSupported]);

  const stopSpoken = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const myGen = genRef.current;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    const durationMs = Date.now() - startRef.current;
    setState("transcribing");
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (durationMs < VOICE_MIN_RECORDING_MS) {
      setState("idle");
      return;
    }
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
    if (blob.size === 0 || blob.size > VOICE_MAX_AUDIO_BYTES) {
      setState("idle");
      setMicError(true);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
    try {
      const form = new FormData();
      form.append("audio", blob, "clip.webm");
      form.append("voiceLang", voiceLang);
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: form, signal: controller.signal });
      if (myGen !== genRef.current) return;
      if (!res.ok) {
        setState("idle");
        setMicError(true);
        return;
      }
      const data = (await res.json()) as { transcript?: string; languageCode?: string | null };
      const text = data.transcript?.trim();
      if (data.languageCode) observeDetected(data.languageCode);
      if (!text) {
        setState("idle");
        setMicError(true);
        return;
      }
      push("user", text);
      await ask(text, { alreadyPushed: true });
    } catch {
      if (myGen === genRef.current) {
        setState("idle");
        setMicError(true);
      }
    } finally {
      clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceLang, observeDetected, push, ask]);

  const reset = useCallback(() => {
    genRef.current += 1;
    cleanup();
    setTurns([]);
    setMicError(false);
    setState("idle");
  }, []);

  return { state, turns, micSupported, micError, ask, askSpoken, stopSpoken, reset };
}
