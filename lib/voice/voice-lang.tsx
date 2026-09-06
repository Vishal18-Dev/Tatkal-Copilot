"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fromBcp47, isVoiceLang, VOICE_LANGS, type VoiceLang } from "./languages";
import { useLang } from "@/lib/i18n";
import { toShortLang, toSupportedLanguage } from "@/lib/i18n/types";

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
  const { conversationLanguage, setConversationLanguage, setDetectedLanguage } = useLang();
  const [locked, setLocked] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isVoiceLang(saved)) {
        setConversationLanguage(toSupportedLanguage(saved));
      }
      if (localStorage.getItem(LOCK_KEY) === "1") setLocked(true);
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, [setConversationLanguage]);

  const setVoiceLang = useCallback((l: VoiceLang) => {
    setConversationLanguage(toSupportedLanguage(l));
    setLocked(true);
    try {
      localStorage.setItem(STORAGE_KEY, l);
      localStorage.setItem(LOCK_KEY, "1");
    } catch {
      /* ignore */
    }
  }, [setConversationLanguage]);

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
      const detected = fromBcp47(bcp47);
      if (!detected) return;
      setDetectedLanguage(toSupportedLanguage(detected));
      if (locked) return; // user's explicit choice wins
      try {
        localStorage.setItem(STORAGE_KEY, detected);
      } catch {
        /* ignore */
      }
    },
    [locked, setDetectedLanguage]
  );

  const voiceLang = useMemo(() => toShortLang(conversationLanguage), [conversationLanguage]);

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
