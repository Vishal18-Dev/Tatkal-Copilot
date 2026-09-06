"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import {
  type SupportedLanguage,
  type ShortLang,
  type LanguageState,
  toSupportedLanguage,
  toShortLang,
} from "./i18n/types";
import { translateKey } from "./i18n/catalogs";

export type { SupportedLanguage, ShortLang, LanguageState };
export type Lang = ShortLang;

const STORAGE_UI_KEY = "tatkal-ui-lang";
const STORAGE_CONV_KEY = "tatkal-conversation-lang";
const LEGACY_STORAGE_KEY = "tatkal-lang";

interface Ctx {
  /** Selected UI language (SupportedLanguage format, e.g. "en-IN") */
  uiLanguage: SupportedLanguage;
  /** Active Conversation language (SupportedLanguage format, e.g. "hi-IN") */
  conversationLanguage: SupportedLanguage;
  /** Optional last detected speech language */
  detectedLanguage?: SupportedLanguage;
  /** Legacy short code format for UI (e.g. "en" or "hi") */
  lang: ShortLang;
  /** Set explicit UI language (also updates conversation language if no separate preference) */
  setUiLanguage: (l: SupportedLanguage | ShortLang) => void;
  /** Set explicit Conversation language */
  setConversationLanguage: (l: SupportedLanguage | ShortLang) => void;
  /** Set detected language from STT/utterance (does NOT mutate uiLanguage) */
  setDetectedLanguage: (l?: SupportedLanguage | ShortLang | null) => void;
  /** Legacy setLang compatibility */
  setLang: (l: SupportedLanguage | ShortLang) => void;
  /** Toggle between en-IN and hi-IN UI language */
  toggle: () => void;
  /** Central translation resolver */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [uiLanguage, setUiLangState] = useState<SupportedLanguage>("en-IN");
  const [conversationLanguage, setConvLangState] = useState<SupportedLanguage>("en-IN");
  const [detectedLanguage, setDetectedLangState] = useState<SupportedLanguage | undefined>(undefined);
  const [convLocked, setConvLocked] = useState(false);

  useEffect(() => {
    try {
      const savedUi = localStorage.getItem(STORAGE_UI_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (savedUi) {
        const full = toSupportedLanguage(savedUi);
        setUiLangState(full);
        setConvLangState(full);
      }
      const savedConv = localStorage.getItem(STORAGE_CONV_KEY);
      if (savedConv) {
        setConvLangState(toSupportedLanguage(savedConv));
        setConvLocked(true);
      }
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const setUiLanguage = useCallback((l: SupportedLanguage | ShortLang) => {
    const full = toSupportedLanguage(l);
    setUiLangState(full);
    try {
      localStorage.setItem(STORAGE_UI_KEY, full);
      localStorage.setItem(LEGACY_STORAGE_KEY, toShortLang(full));
    } catch {
      /* ignore */
    }
    // If conversation language is unlocked, sync it with UI language choice
    if (!convLocked) {
      setConvLangState(full);
    }
  }, [convLocked]);

  const setConversationLanguage = useCallback((l: SupportedLanguage | ShortLang) => {
    const full = toSupportedLanguage(l);
    setConvLangState(full);
    setConvLocked(true);
    try {
      localStorage.setItem(STORAGE_CONV_KEY, full);
    } catch {
      /* ignore */
    }
  }, []);

  const setDetectedLanguage = useCallback(
    (l?: SupportedLanguage | ShortLang | null) => {
      if (!l) {
        setDetectedLangState(undefined);
        return;
      }
      const full = toSupportedLanguage(l);
      setDetectedLangState(full);
      // Detected speech language updates conversation language ONLY when conversation language is not manually locked
      if (!convLocked) {
        setConvLangState(full);
      }
    },
    [convLocked]
  );

  const toggle = useCallback(() => {
    setUiLangState((prev) => {
      const next = prev === "en-IN" ? "hi-IN" : "en-IN";
      try {
        localStorage.setItem(STORAGE_UI_KEY, next);
        localStorage.setItem(LEGACY_STORAGE_KEY, toShortLang(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translateKey(uiLanguage, key, params);
    },
    [uiLanguage]
  );

  const value = useMemo(
    () => ({
      uiLanguage,
      conversationLanguage,
      detectedLanguage,
      lang: toShortLang(uiLanguage),
      setUiLanguage,
      setConversationLanguage,
      setDetectedLanguage,
      setLang: setUiLanguage,
      toggle,
      t,
    }),
    [
      uiLanguage,
      conversationLanguage,
      detectedLanguage,
      setUiLanguage,
      setConversationLanguage,
      setDetectedLanguage,
      toggle,
      t,
    ]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
