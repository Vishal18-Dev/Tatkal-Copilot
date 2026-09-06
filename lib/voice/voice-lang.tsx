"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fromBcp47, isVoiceLang, VOICE_LANGS, type VoiceLang } from "./languages";

/* ============================================================
   VoiceLang context — the active *spoken* language.

   Separate from the app UI `Lang` (en/hi chrome). This is
   conversation context: which of the 10 languages the user is
   speaking/hearing right now. Persisted so a returning user keeps
   their language, and auto-updated from Sarvam's detected language
   UNLESS the user has explicitly chosen one (manual override wins —
   spec §20: "Allow manual override").
   ============================================================ */

const STORAGE_KEY = "tatkal-voice-lang";
const LOCK_KEY = "tatkal-voice-lang-locked";

interface VoiceLangCtx {
  voiceLang: VoiceLang;
  /** True once the user has explicitly picked a language (detection stops overriding). */
  locked: boolean;
  /** Explicit user choice — locks the language. */
  setVoiceLang: (l: VoiceLang) => void;
  /** Return to automatic detection — the agent follows the language you speak. */
  setAuto: () => void;
  /** Feed a Sarvam-detected BCP-47 code; updates only while unlocked. */
  observeDetected: (bcp47: string | null | undefined) => void;
  langs: typeof VOICE_LANGS;
}

const Ctx = createContext<VoiceLangCtx | null>(null);

export function VoiceLangProvider({ children }: { children: React.ReactNode }) {
  const [voiceLang, setState] = useState<VoiceLang>("en");
  const [locked, setLocked] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isVoiceLang(saved)) setState(saved);
      if (localStorage.getItem(LOCK_KEY) === "1") setLocked(true);
    } catch {
      /* storage unavailable — defaults are fine */
    }
    hydrated.current = true;
  }, []);

  const setVoiceLang = useCallback((l: VoiceLang) => {
    setState(l);
    setLocked(true);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      localStorage.setItem(LOCK_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setAuto = useCallback(() => {
    setLocked(false);
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const observeDetected = useCallback(
    (bcp47: string | null | undefined) => {
      if (locked) return; // user's explicit choice wins
      const detected = fromBcp47(bcp47);
      if (!detected) return;
      setState(detected);
      try {
        localStorage.setItem(STORAGE_KEY, detected);
      } catch {
        /* ignore */
      }
    },
    [locked]
  );

  const value = useMemo(
    () => ({ voiceLang, locked, setVoiceLang, setAuto, observeDetected, langs: VOICE_LANGS }),
    [voiceLang, locked, setVoiceLang, setAuto, observeDetected]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVoiceLang(): VoiceLangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVoiceLang must be used within VoiceLangProvider");
  return ctx;
}
