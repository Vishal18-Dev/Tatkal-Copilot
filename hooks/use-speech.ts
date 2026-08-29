"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Lang } from "@/lib/i18n";

/* Minimal typings for the Web Speech API (not in TS lib DOM by default). */
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function useSpeech(lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;
    if (Ctor) {
      setSupported(true);
      recRef.current = new Ctor();
    }
  }, []);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    setTranscript("");
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, start, stop, setTranscript };
}
