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
  | "compose"
  | "thinking"
  | "strategy"
  | "vault"
  | "review"
  | "authorize";

export const STEP_ORDER: Step[] = [
  "compose",
  "thinking",
  "strategy",
  "vault",
  "review",
  "authorize",
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
}

interface JourneyCtx extends JourneyState {
  goTo: (step: Step) => void;
  submitGoal: (goal: string) => void;
  chooseOption: (id: string) => void;
  togglePassenger: (id: string) => void;
  setSelected: (ids: string[]) => void;
  setMode: (m: BookingMode) => void;
  setAuthorization: (a: BookingAuthorization) => void;
  setBookingResult: (r: BookingResult) => void;
  selectedPassengers: Traveller[];
  recommendedOption: StrategyOption | null;
  chosenOption: StrategyOption | null;
  recoveryOption: StrategyOption | null;
  restart: () => void;
}

const Ctx = createContext<JourneyCtx | null>(null);

export function JourneyProvider({
  children,
  initialGoal,
}: {
  children: ReactNode;
  initialGoal?: string;
}) {
  const { travellers, preferences } = useStore();

  const [state, setState] = useState<JourneyState>(() => ({
    step: initialGoal ? "thinking" : "compose",
    goal: initialGoal ?? "",
    plan: null,
    planning: !!initialGoal,
    planError: false,
    chosenOptionId: null,
    selectedPassengerIds: [],
    mode: preferences.defaultMode,
    authorization: null,
    bookingResult: null,
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

  // Preselect the user's first two travellers once they're available.
  useEffect(() => {
    setState((s) => {
      if (s.selectedPassengerIds.length > 0 || travellers.length === 0) return s;
      return { ...s, selectedPassengerIds: travellers.slice(0, 2).map((t) => t.id) };
    });
  }, [travellers]);

  const runPlan = useCallback((goal: string) => {
    generatePlan(goal)
      .then((plan) =>
        setState((s) => ({
          ...s,
          plan,
          chosenOptionId: plan.recommendedId,
          planning: false,
          planError: false,
        }))
      )
      .catch(() => setState((s) => ({ ...s, planning: false, planError: true })));
  }, []);

  const goTo = useCallback((step: Step) => {
    setState((s) => ({ ...s, step }));
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const submitGoal = useCallback(
    (goal: string) => {
      setState((s) => ({
        ...s,
        goal,
        step: "thinking",
        planning: true,
        planError: false,
        plan: null,
        chosenOptionId: null,
        bookingResult: null,
        authorization: null,
      }));
      if (typeof window !== "undefined")
        window.scrollTo({ top: 0, behavior: "smooth" });
      runPlan(goal);
    },
    [runPlan]
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

  const restart = useCallback(
    () =>
      setState((s) => ({
        step: "compose",
        goal: "",
        plan: null,
        planning: false,
        planError: false,
        chosenOptionId: null,
        selectedPassengerIds: s.selectedPassengerIds,
        mode: preferences.defaultMode,
        authorization: null,
        bookingResult: null,
      })),
    [preferences.defaultMode]
  );

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

export function useJourney(): JourneyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJourney must be used within JourneyProvider");
  return ctx;
}
