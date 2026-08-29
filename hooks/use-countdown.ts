"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Options {
  from: number; // seconds
  autoStart?: boolean;
  onComplete?: () => void;
}

/** Smooth 1s countdown with pause + demo fast-forward. */
export function useCountdown({ from, autoStart = true, onComplete }: Options) {
  const [seconds, setSeconds] = useState(from);
  const [running, setRunning] = useState(autoStart);
  const doneRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  // Tick — the updater stays pure (no side effects during render).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fire completion from an effect, never inside a state updater.
  useEffect(() => {
    if (seconds <= 0 && !doneRef.current) {
      doneRef.current = true;
      completeRef.current?.();
    }
  }, [seconds]);

  const fastForward = useCallback(() => {
    // jump close to zero for demos
    setSeconds((s) => Math.min(s, 6));
  }, []);

  const pause = useCallback(() => setRunning(false), []);
  const resume = useCallback(() => setRunning(true), []);

  return { seconds, running, done: seconds <= 0, fastForward, pause, resume };
}
