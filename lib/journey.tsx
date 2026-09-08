"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type {
  Plan,
  Traveller,
  StrategyOption,
  BookingMode,
  BookingAuthorization,
  BookingRecord,
} from "@/types";
import type { BookingStep } from "@/lib/providers";
import { generatePlan } from "@/lib/ai";
import { useStore } from "@/lib/store";

export type Step =
  | "plan"
  | "options"
  | "prepare"
  | "book"
  | "compose"
  | "thinking"
  | "strategy"
  | "vault"
  | "review"
  | "authorize";

export const STEP_ORDER: Step[] = [
  "plan",
  "options",
  "prepare",
  "book",
];

export interface BookingResult {
  record: BookingRecord;
  steps: BookingStep[];
}

interface JourneyState {
  step: Step;
  goal: string;
  plan: Plan | null;
  planning: boolean;
  planError: boolean;
  chosenOptionId: string | null;
  selectedPassengerIds: string[];
  mode: BookingMode;
  authorization: BookingAuthorization | null;
  bookingResult: BookingResult | null;
  autoFallbackEnabled: boolean;
}

interface JourneyCtx extends JourneyState {
  goTo: (step: Step) => void;
  submitGoal: (goal: string) => void;
  setPlan: (plan: Plan) => void;
  chooseOption: (id: string) => void;
  togglePassenger: (id: string) => void;
  setSelected: (ids: string[]) => void;
  setMode: (m: BookingMode) => void;
  setAuthorization: (a: BookingAuthorization) => void;
  setBookingResult: (r: BookingResult) => void;
  setAutoFallbackEnabled: (enabled: boolean) => void;
  selectedPassengers: Traveller[];
  recommendedOption: StrategyOption | null;
  chosenOption: StrategyOption | null;
  recoveryOption: StrategyOption | null;
  restart: () => void;
}

const Ctx = createContext<JourneyCtx | null>(null);

export function matchSpokenPassengers(text: string, travellers: Traveller[]): string[] {
  if (!text || !travellers.length) return [];
  const lower = text.toLowerCase();
  const matchedIds: string[] = [];
  for (const t of travellers) {
    const firstName = t.name.split(" ")[0].toLowerCase();
    const fullName = t.name.toLowerCase();
    const reFirst = new RegExp(`\\b${firstName}\\b`, "i");
    const reFull = new RegExp(`\\b${fullName}\\b`, "i");
    if (reFirst.test(lower) || reFull.test(lower)) {
      matchedIds.push(t.id);
    }
  }
  return matchedIds;
}

export function JourneyProvider({
  children,
  initialGoal,
}: {
  children: ReactNode;
  initialGoal?: string;
}) {
  const { travellers, preferences } = useStore();

  const [state, setState] = useState<JourneyState>(() => ({
    step: initialGoal ? "plan" : "plan",
    goal: initialGoal ?? "",
    plan: null,
    planning: !!initialGoal,
    planError: false,
    chosenOptionId: null,
    selectedPassengerIds: [],
    mode: preferences.defaultMode,
    authorization: null,
    bookingResult: null,
    autoFallbackEnabled: true,
  }));

  // Kick off planning if an initial goal was provided (once).
  const startedRef = useRef(false);
  useEffect(() => {
    if (initialGoal && !startedRef.current) {
      startedRef.current = true;
      runPlan(initialGoal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGoal]);

  const runPlan = useCallback((goal: string) => {
    const spokenPassengerIds = matchSpokenPassengers(goal, travellers);
    generatePlan(goal)
      .then((plan) =>
        setState((s) => ({
          ...s,
          plan,
          chosenOptionId: plan.recommendedId,
          selectedPassengerIds: spokenPassengerIds.length > 0 ? spokenPassengerIds : s.selectedPassengerIds,
          planning: false,
          planError: false,
        }))
      )
      .catch(() => setState((s) => ({ ...s, planning: false, planError: true })));
  }, [travellers]);

  const goTo = useCallback((step: Step) => {
    let normalized = step;
    if (step === "compose" || step === "thinking") normalized = "plan";
    else if (step === "strategy") normalized = "options";
    else if (step === "vault") normalized = "prepare";
    else if (step === "review" || step === "authorize") normalized = "book";

    setState((s) => ({ ...s, step: normalized }));
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setPlan = useCallback((plan: Plan) => {
    const spokenPassengerIds = matchSpokenPassengers(plan.intent.restated || "", travellers);
    setState((s) => ({
      ...s,
      plan,
      chosenOptionId: plan.recommendedId,
      selectedPassengerIds: spokenPassengerIds.length > 0 ? spokenPassengerIds : s.selectedPassengerIds,
      planning: false,
      planError: false,
    }));
  }, [travellers]);

  const setAutoFallbackEnabled = useCallback((autoFallbackEnabled: boolean) => {
    setState((s) => ({ ...s, autoFallbackEnabled }));
  }, []);

  const submitGoal = useCallback(
    (goal: string) => {
      const spokenPassengerIds = matchSpokenPassengers(goal, travellers);
      setState((s) => ({
        ...s,
        goal,
        step: "plan",
        planning: true,
        planError: false,
        plan: null,
        chosenOptionId: null,
        selectedPassengerIds: spokenPassengerIds,
        bookingResult: null,
        authorization: null,
      }));
      if (typeof window !== "undefined")
        window.scrollTo({ top: 0, behavior: "smooth" });
      runPlan(goal);
    },
    [runPlan, travellers]
  );

  const chooseOption = useCallback(
    (id: string) => setState((s) => ({ ...s, chosenOptionId: id })),
    []
  );

  const togglePassenger = useCallback((id: string) => {
    setState((s) => {
      const has = s.selectedPassengerIds.includes(id);
      return {
        ...s,
        selectedPassengerIds: has
          ? s.selectedPassengerIds.filter((p) => p !== id)
          : [...s.selectedPassengerIds, id],
      };
    });
  }, []);

  const setSelected = useCallback(
    (ids: string[]) => setState((s) => ({ ...s, selectedPassengerIds: ids })),
    []
  );

  const setMode = useCallback(
    (mode: BookingMode) => setState((s) => ({ ...s, mode })),
    []
  );

  const setAuthorization = useCallback(
    (authorization: BookingAuthorization) =>
      setState((s) => ({ ...s, authorization })),
    []
  );

  const setBookingResult = useCallback(
    (bookingResult: BookingResult) => setState((s) => ({ ...s, bookingResult })),
    []
  );

  const restart = useCallback(() => {
    setState((s) => ({
      step: "plan",
      goal: "",
      plan: null,
      planning: false,
      planError: false,
      chosenOptionId: null,
      selectedPassengerIds: [],
      mode: "assisted",
      authorization: null,
      bookingResult: null,
      autoFallbackEnabled: true,
    }));
  }, []);

  const selectedPassengers = useMemo(
    () => travellers.filter((t) => state.selectedPassengerIds.includes(t.id)),
    [travellers, state.selectedPassengerIds]
  );

  const recommendedOption = useMemo(
    () => state.plan?.options.find((o) => o.id === state.plan?.recommendedId) ?? null,
    [state.plan]
  );

  const chosenOption = useMemo(
    () =>
      state.plan?.options.find((o) => o.id === state.chosenOptionId) ??
      recommendedOption,
    [state.plan, state.chosenOptionId, recommendedOption]
  );

  const recoveryOption = useMemo(() => {
    if (!state.plan || !chosenOption) return null;
    const others = state.plan.options.filter((o) => o.id !== chosenOption.id);
    return [...others].sort((a, b) => b.confirmProbability - a.confirmProbability)[0] ?? null;
  }, [state.plan, chosenOption]);

  const value = useMemo<JourneyCtx>(
    () => ({
      ...state,
      goTo,
      submitGoal,
      chooseOption,
      togglePassenger,
      setSelected,
      setMode,
      setAuthorization,
      setBookingResult,
      setPlan,
      setAutoFallbackEnabled,
      selectedPassengers,
      recommendedOption,
      chosenOption,
      recoveryOption,
      restart,
    }),
    [
      state,
      goTo,
      submitGoal,
      setPlan,
      setAutoFallbackEnabled,
      chooseOption,
      togglePassenger,
      setSelected,
      setMode,
      setAuthorization,
      setBookingResult,
      selectedPassengers,
      recommendedOption,
      chosenOption,
      recoveryOption,
      restart,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOptionalJourney(): JourneyCtx | null {
  return useContext(Ctx);
}

export function useJourney(): JourneyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  return ctx;
}
