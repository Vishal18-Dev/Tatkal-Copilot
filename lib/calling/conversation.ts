"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import type { CallScript, CallState, CallStep } from "./types";

export interface CallLine {
  id: string;
  text: string;
}

export function useCallConversation(script: CallScript, lang: Lang, onAction: (action: "open_trip" | "open_plan") => void) {
  const [state, setState] = useState<CallState>("idle");
  const [lines, setLines] = useState<CallLine[]>([]);
  const [currentStep, setCurrentStep] = useState<CallStep | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genRef = useRef(0);

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const speakStep = useCallback(
    async (step: CallStep, myGen: number) => {
      setCurrentStep(step);
      setLines((l) => [...l, { id: step.id, text: step.text }]);
      setState("speaking");

      try {
        const res = await fetch("/api/calling/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: step.text, lang }),
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
          // No TTS available — hold on the caption long enough to read it.
          await new Promise((r) => setTimeout(r, Math.min(4000, 900 + step.text.length * 35)));
        }
      } finally {
        if (myGen !== genRef.current) return;
        if (step.replies && step.replies.length > 0) {
          setState("awaiting_reply");
        } else if (step.next && script.steps[step.next]) {
          await new Promise((r) => setTimeout(r, 400));
          if (myGen === genRef.current) await speakStep(script.steps[step.next], myGen);
        } else {
          setState("ended");
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, script]
  );

  const accept = useCallback(async () => {
    genRef.current += 1;
    const myGen = genRef.current;
    setLines([]);
    setState("connecting");
    await new Promise((r) => setTimeout(r, 600));
    if (myGen !== genRef.current) return;
    await speakStep(script.steps.start, myGen);
  }, [script, speakStep]);

  const decline = useCallback(() => {
    genRef.current += 1;
    cleanup();
    setState("ended");
  }, [cleanup]);

  const reply = useCallback(
    async (nextId: string, action?: "open_trip" | "open_plan" | "none") => {
      const myGen = genRef.current;
      if (action === "open_trip" || action === "open_plan") onAction(action);
      const next = script.steps[nextId];
      if (!next) {
        setState("ended");
        return;
      }
      await speakStep(next, myGen);
    },
    [script, speakStep, onAction]
  );

  const ring = useCallback(() => setState("ringing"), []);

  return { state, lines, currentStep, ring, accept, decline, reply };
}
