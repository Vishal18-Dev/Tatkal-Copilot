"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useOptionalJourney } from "@/lib/journey";
import { useLang } from "@/lib/i18n";
import { Step4BookScreen } from "@/features/booking-flow/step4-book-screen";
import { CANONICAL_DEMO_TRIP_ID, createCanonicalDemoTrip, type DemoScenario } from "@/lib/demo/scenarios";
import type { Trip } from "@/types";

function BookContent() {
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get("tripId");
  const scenarioParam = searchParams.get("scenario") as DemoScenario | null;
  const { trips, getTrip, hydrated } = useStore();
  const { t } = useLang();
  const optionalJourney = useOptionalJourney();

  if (!hydrated) return null;

  // 1. If tripId param passed, find exact trip
  let targetTrip: Trip | undefined = tripIdParam ? getTrip(tripIdParam) : undefined;

  // 2. Fall back to current_plan_trip synthesized from optionalJourney if plan exists
  if (!targetTrip && optionalJourney?.plan) {
    const plan = optionalJourney.plan;
    const primaryOpt = optionalJourney.chosenOption || plan.options[0];
    const backupOpt = optionalJourney.recoveryOption || plan.options[1];
    targetTrip = {
      id: "current_plan_trip",
      status: "upcoming",
      from: plan.intent.from,
      fromCode: plan.intent.fromCode,
      to: plan.intent.to,
      toCode: plan.intent.toCode,
      dateLabel: "Tomorrow",
      trainName: primaryOpt?.title || "Primary Express",
      travelClass: (primaryOpt?.travelClass as any) || "3A",
      travellerIds: optionalJourney.selectedPassengers.map((p) => p.id),
      boardingStationName: primaryOpt?.boardingStationName || plan.intent.from,
      arrivalDisplay: primaryOpt?.arrivalDisplay || "08:00 · tomorrow",
      fare: primaryOpt?.fare || 2500,
      mode: optionalJourney.mode || "assisted",
      agentState: "scheduled",
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      arrivalTargetLabel: plan.intent.arrivalDeadline ? `before ${plan.intent.arrivalDeadline}` : "morning",
      primary: {
        optionId: primaryOpt?.id || "p1",
        trainName: primaryOpt?.title || "Primary Express",
        travelClass: (primaryOpt?.travelClass as any) || "3A",
        boardingStationName: primaryOpt?.boardingStationName || plan.intent.from,
        departureDisplay: primaryOpt?.departureDisplay || "16:00",
        arrivalDisplay: primaryOpt?.arrivalDisplay || "08:00 · tomorrow",
        level: primaryOpt?.level || "High",
        fare: primaryOpt?.fare || 2500,
      },
      backup: backupOpt
        ? {
            optionId: backupOpt.id,
            trainName: backupOpt.title,
            travelClass: (backupOpt.travelClass as any) || "3A",
            boardingStationName: backupOpt.boardingStationName || plan.intent.from,
            departureDisplay: backupOpt.departureDisplay || "16:35",
            arrivalDisplay: backupOpt.arrivalDisplay || "08:30 · tomorrow",
            level: backupOpt.level || "High",
            fare: backupOpt.fare || 2500,
          }
        : null,
      readinessDone: [],
      planNotifications: [],
      createdAt: new Date().toISOString(),
    };
  }

  // 3. Fall back to demo trip or latest upcoming trip in store
  if (!targetTrip) {
    targetTrip =
      trips.find((tr) => tr.id === CANONICAL_DEMO_TRIP_ID) ??
      trips.find((tr) => tr.agentState !== "confirmed") ??
      trips[0] ??
      createCanonicalDemoTrip();
  }

  return <Step4BookScreen trip={targetTrip} initialScenario={scenarioParam} />;
}

export default function BookPage() {
  return (
    <Suspense fallback={null}>
      <BookContent />
    </Suspense>
  );
}
