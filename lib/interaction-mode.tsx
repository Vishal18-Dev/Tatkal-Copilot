"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig } from "framer-motion";
import Script from "next/script";

/* ============================================================
   Interaction mode — the accessibility entry point (spec §19/§20).

   "How would you like to use Tatkal Copilot?"
     visual     — see and tap (the default).
     voice      — speak and listen; voice affordances lead.
     accessible — larger type, stronger focus, calmer motion,
                  voice-first. NOT a separate, lesser product —
                  the same Copilot, tuned for a different way of
                  interacting.

   Persisted like the theme (its own localStorage key + a pre-paint
   script so accessible sizing doesn't flash). The chosen mode is
   reflected on <html data-interaction-mode>, which globals.css and
   components read; accessible mode additionally forces reduced
   motion through Framer's MotionConfig.
   ============================================================ */

export type InteractionMode = "visual" | "voice" | "accessible";

export const INTERACTION_MODES: InteractionMode[] = ["visual", "voice", "accessible"];

export function isInteractionMode(v: unknown): v is InteractionMode {
  return v === "visual" || v === "voice" || v === "accessible";
}

const MODE_KEY = "tatkal-interaction-mode";
const CHOSEN_KEY = "tatkal-interaction-chosen";

interface InteractionModeCtx {
  /** The effective mode (defaults to "visual" until a choice is made). */
  mode: InteractionMode;
  /** Whether the user has explicitly answered the chooser. */
  chosen: boolean;
  /** Pick a mode — records an explicit choice and closes the chooser. */
  setMode: (m: InteractionMode) => void;
  /** Close the chooser without changing the mode (stays visual). */
  dismissChooser: () => void;
  /** Re-open the chooser (e.g. from Settings). */
  reopenChooser: () => void;
}

const Ctx = createContext<InteractionModeCtx | null>(null);

function applyMode(mode: InteractionMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-interaction-mode", mode);
}

/**
 * Runs inline before hydration so accessible sizing/motion is right on the
 * first paint. Mirrors the read the provider does; kept in sync by hand.
 */
export function InteractionModeScript() {
  const code = `(function(){try{var m=localStorage.getItem("${MODE_KEY}");if(m!=="voice"&&m!=="accessible")m="visual";document.documentElement.setAttribute("data-interaction-mode",m);}catch(e){}})();`;
  return (
    <Script id="interaction-mode-init" strategy="beforeInteractive">
      {code}
    </Script>
  );
}

export function InteractionModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<InteractionMode>("visual");
  const [chosen, setChosen] = useState(true); // assume chosen until we read storage (avoids SSR flash of the chooser)

  useEffect(() => {
    let savedMode: InteractionMode = "visual";
    let didChoose = false;
    try {
      const raw = localStorage.getItem(MODE_KEY);
      if (isInteractionMode(raw)) savedMode = raw;
      didChoose = localStorage.getItem(CHOSEN_KEY) === "1";
    } catch {
      /* ignore */
    }
    setModeState(savedMode);
    setChosen(didChoose);
    applyMode(savedMode);
  }, []);

  const persist = useCallback((m: InteractionMode, markChosen: boolean) => {
    applyMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
      if (markChosen) localStorage.setItem(CHOSEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setMode = useCallback(
    (m: InteractionMode) => {
      setModeState(m);
      setChosen(true);
      persist(m, true);
    },
    [persist]
  );

  const dismissChooser = useCallback(() => {
    setChosen(true);
    persist(mode, true);
  }, [mode, persist]);

  const reopenChooser = useCallback(() => {
    setChosen(false);
    try {
      localStorage.removeItem(CHOSEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ mode, chosen, setMode, dismissChooser, reopenChooser }),
    [mode, chosen, setMode, dismissChooser, reopenChooser]
  );

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={mode === "accessible" ? "always" : "user"}>{children}</MotionConfig>
    </Ctx.Provider>
  );
}

export function useInteractionMode(): InteractionModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInteractionMode must be used within InteractionModeProvider");
  return ctx;
}
