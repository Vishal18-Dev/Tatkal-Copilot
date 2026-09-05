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
import Script from "next/script";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeCtx {
  /** What the user chose — may be "system". */
  preference: ThemePreference;
  /** What's actually on screen right now (system resolved to light/dark). */
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  /** Cycles light → dark → system → light. */
  cycle: () => void;
}

const STORAGE_KEY = "tatkal-theme";
const Ctx = createContext<ThemeCtx | null>(null);

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") {
    root.removeAttribute("data-theme");
    root.style.colorScheme = "light dark";
  } else {
    root.setAttribute("data-theme", preference);
    root.style.colorScheme = preference;
  }
}

/**
 * Renders inline, before hydration, so the very first paint already has the
 * right theme (no flash of the wrong palette). Mirrors the same read the
 * provider does below, kept in sync manually since it runs outside React.
 */
export function ThemeScript() {
  const code = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var root=document.documentElement;if(p==="system"){root.style.colorScheme="light dark";}else{root.setAttribute("data-theme",p);root.style.colorScheme=p;}}catch(e){}})();`;
  return <Script id="theme-init" strategy="beforeInteractive">{code}</Script>;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Pick up whatever the inline script already applied, then keep in sync.
  useEffect(() => {
    let saved: ThemePreference = "system";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") saved = raw;
    } catch {
      /* ignore */
    }
    setPreferenceState(saved);
    setResolved(saved === "system" ? (systemPrefersDark() ? "dark" : "light") : saved);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setPreferenceState((p) => {
        if (p === "system") setResolved(mq.matches ? "dark" : "light");
        return p;
      });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    setResolved(p === "system" ? (systemPrefersDark() ? "dark" : "light") : p);
    apply(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const cycle = useCallback(() => {
    setPreference(preference === "light" ? "dark" : preference === "dark" ? "system" : "light");
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
