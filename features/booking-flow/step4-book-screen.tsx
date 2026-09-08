"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Radio,
  Smartphone,
  Check,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Ticket,
  ChevronRight,
  Layers,
  HeartHandshake,
  AlertCircle,
  Play,
  PhoneCall,
  ShieldAlert,
  Wallet,
  AlertTriangle,
  Bot,
  Plus,
  ArrowUpRight,
  FastForward,
  Pause,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptionalJourney } from "@/lib/journey";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { cn, formatFare } from "@/lib/utils";
import { CallButton } from "@/components/calling/CallButton";
import { IncomingCallModal, type CallQuickReply } from "@/components/calling/IncomingCallModal";
import { PermissionRequestModal } from "@/components/calling/PermissionRequestModal";
import { AddMoneyModal } from "@/components/wallet/AddMoneyModal";
import {
  type DemoScenario,
  type ScenarioPhase,
  type StrategyTimelineState,
  HEADLINE_SCENARIOS,
  DEMO_SCENARIO_DEFINITIONS,
  buildTMinus5Briefing,
  evaluatePremiumTatkalGuard,
} from "@/lib/demo/scenarios";
import {
  DemoClock,
  DEMO_ENVIRONMENT_TIMELINE,
  type DemoEnvironmentBeat,
  type DemoClockStatus,
} from "@/lib/demo-clock";
import type { Trip } from "@/types";

export function Step4BookScreen({
  trip: externalTrip,
  initialScenario,
}: {
  trip?: Trip | null;
  initialScenario?: DemoScenario | null;
} = {}) {
  const router = useRouter();
  const optionalJourney = useOptionalJourney();
  const plan = optionalJourney?.plan;
  const chosenOption = optionalJourney?.chosenOption;
  const recoveryOption = optionalJourney?.recoveryOption;
  const { travellers, addTrip, updateTrip, trips, wallet, logActivity } = useStore();
  const { t } = useLang();

  const primaryTrain = chosenOption || plan?.options[0];
  const backupTrain = recoveryOption || plan?.options[1];

  const primaryTrainName =
    externalTrip?.primary?.trainName ||
    externalTrip?.trainName ||
    (primaryTrain
      ? `${primaryTrain.trainNumber ? `#${primaryTrain.trainNumber} ` : ""}${primaryTrain.title}`
      : "12951 TEJAS RAJDHANI");

  const backupTrainName =
    externalTrip?.backup?.trainName ||
    (backupTrain
      ? `${backupTrain.trainNumber ? `#${backupTrain.trainNumber} ` : ""}${backupTrain.title}`
      : "12953 August Kranti Rajdhani");

  const autoFallbackEnabled = externalTrip
    ? Boolean(externalTrip.backup)
    : (optionalJourney?.autoFallbackEnabled ?? true);

  const tripPassengers = externalTrip?.travellerIds
    ? travellers.filter((tr) => externalTrip.travellerIds.includes(tr.id))
    : [];

  const activePassengers =
    tripPassengers.length > 0
      ? tripPassengers
      : (optionalJourney?.selectedPassengers && optionalJourney.selectedPassengers.length > 0)
      ? optionalJourney.selectedPassengers
      : travellers.slice(0, 2);

  const fromName = externalTrip?.from || plan?.intent.from || "Mumbai Central";
  const fromCode = externalTrip?.fromCode || plan?.intent.fromCode || "MMCT";
  const toName = externalTrip?.to || plan?.intent.to || "New Delhi";
  const toCode = externalTrip?.toCode || plan?.intent.toCode || "NDLS";
  const departureDisplay =
    externalTrip?.primary?.departureDisplay ||
    primaryTrain?.departureDisplay ||
    "16:55 (Tomorrow)";
  const arrivalDisplay =
    externalTrip?.primary?.arrivalDisplay ||
    externalTrip?.arrivalDisplay ||
    primaryTrain?.arrivalDisplay ||
    "08:35 (+1 Day)";
  const farePerPassenger =
    externalTrip?.primary?.fare || externalTrip?.fare || primaryTrain?.fare || 2845;
  const totalFare = farePerPassenger * Math.max(1, activePassengers.length);

  // Active trip synced with store
  const activeTrip = useMemo(() => {
    if (externalTrip?.id) {
      const found = trips.find((tr) => tr.id === externalTrip.id);
      if (found) return found;
    }
    return trips.find((tr) => tr.agentState !== "confirmed") || trips[trips.length - 1] || null;
  }, [externalTrip, trips]);

  const [activeTripId, setActiveTripId] = useState<string>(externalTrip?.id || "");

  // Sync trip to store on step4 mount only if not an existing trip
  useEffect(() => {
    if (externalTrip || !plan || !primaryTrain) return;
    const newTrip = addTrip({
      status: "upcoming",
      from: plan.intent.from,
      fromCode: plan.intent.fromCode,
      to: plan.intent.to,
      toCode: plan.intent.toCode,
      dateLabel: "Tomorrow",
      trainName: primaryTrain.title,
      travelClass: (primaryTrain.travelClass as any) || "3A",
      travellerIds: activePassengers.map((p) => p.id),
      boardingStationName: primaryTrain.boardingStationName || plan.intent.from,
      arrivalDisplay: primaryTrain.arrivalDisplay || "08:00 · tomorrow",
      fare: primaryTrain.fare || 2500,
      mode: optionalJourney?.mode || "assisted",
      agentState: "scheduled",
      agentEnabled: true,
      tatkalOpensAtLabel: "10:00 AM",
      arrivalTargetLabel: plan.intent.arrivalDeadline ? `before ${plan.intent.arrivalDeadline}` : "morning",
      primary: {
        optionId: primaryTrain.id,
        trainName: primaryTrain.title,
        travelClass: (primaryTrain.travelClass as any) || "3A",
        boardingStationName: primaryTrain.boardingStationName || plan.intent.from,
        departureDisplay: primaryTrain.departureDisplay || "16:00",
        arrivalDisplay: primaryTrain.arrivalDisplay || "08:00 · tomorrow",
        level: primaryTrain.level || "High",
        fare: primaryTrain.fare || 2500,
      },
      backup: backupTrain ? {
        optionId: backupTrain.id,
        trainName: backupTrain.title,
        travelClass: (backupTrain.travelClass as any) || "3A",
        boardingStationName: backupTrain.boardingStationName || plan.intent.from,
        departureDisplay: backupTrain.departureDisplay || "16:35",
        arrivalDisplay: backupTrain.arrivalDisplay || "08:30 · tomorrow",
        level: backupTrain.level || "High",
        fare: backupTrain.fare || 2500,
      } : null,
      readinessDone: [],
      planNotifications: [],
    });
    setActiveTripId(newTrip.id);
  }, [plan?.intent.from, plan?.intent.to, externalTrip]);

  // Current effective mode: "assisted" | "auto"
  const currentMode = activeTrip?.mode || optionalJourney?.mode || "assisted";

  // Wall-clock target calculation
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 16, minutes: 42, seconds: 18 });

  useEffect(() => {
    const calculateTarget = () => {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(now.getTime() + istOffset);
      
      const targetIst = new Date(istNow);
      if (istNow.getUTCHours() >= 10) {
        targetIst.setUTCDate(targetIst.getUTCDate() + 1);
      }
      targetIst.setUTCHours(10, 0, 0, 0);

      const diffMs = Math.max(0, targetIst.getTime() - istNow.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      return { hours, minutes, seconds };
    };

    setTimeLeft(calculateTarget());
    const interval = setInterval(() => {
      setTimeLeft(calculateTarget());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ============================================================
     PAYMENT & WALLET READINESS CALCULATIONS (§5, §9)
     ============================================================ */
  const paxCount = Math.max(1, activePassengers.length);
  const ptEstimatePerPax = 3375;
  const estimatedPtTotal = ptEstimatePerPax * paxCount;
  const maxAuthorizedSpend = (activeTrip as any)?.userConstraints?.maxFare || 7000;
  const maxPremiumTatkalFare = (activeTrip as any)?.userConstraints?.maxPremiumTatkalFare || 7500;

  const isWalletSufficient = wallet.balance >= estimatedPtTotal;
  const walletShortfall = isWalletSufficient ? 0 : estimatedPtTotal - wallet.balance;
  const isWithinSpendLimit = estimatedPtTotal <= maxAuthorizedSpend;

  // Add Money Modal State
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);

  /* ============================================================
     HEADLINE DEMO SCENARIO ENGINE & DEMO CLOCK (§1, §2, §4, §10)
     ============================================================ */
  // Synchronized refs to keep initScenario stable without recreating callbacks
  const activeTripRef = useRef(activeTrip);
  activeTripRef.current = activeTrip;
  const optionalJourneyRef = useRef(optionalJourney);
  optionalJourneyRef.current = optionalJourney;
  const updateTripRef = useRef(updateTrip);
  updateTripRef.current = updateTrip;

  const effectiveInitialScenario =
    initialScenario && (HEADLINE_SCENARIOS as readonly string[]).includes(initialScenario)
      ? initialScenario
      : "assisted_briefing";
  const initialDef = DEMO_SCENARIO_DEFINITIONS[effectiveInitialScenario];

  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>(effectiveInitialScenario);
  const [scenarioPhase, setScenarioPhase] = useState<ScenarioPhase>("idle");
  const [timeline, setTimeline] = useState<StrategyTimelineState>({
    primary: "ready",
    backup: "armed",
    premiumTatkal: initialDef.premiumTatkalEnabled ? "available" : "none",
  });

  // Track applied scenario to guarantee single execution per scenario change
  const lastAppliedScenarioRef = useRef<string | null>(null);

  // Demo Clock Integration (Existing Demo Clock Architecture §4)
  const clockRef = useRef<DemoClock | null>(null);
  const [clockStatus, setClockStatus] = useState<DemoClockStatus>("idle");
  const [currentBeat, setCurrentBeat] = useState<DemoEnvironmentBeat | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);

  // Modal dialog states
  const [incomingCallOpen, setIncomingCallOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [callSubtitle, setCallSubtitle] = useState("Your Tatkal briefing is ready.");
  const [callBriefing, setCallBriefing] = useState("");
  const [callQuickReplies, setCallQuickReplies] = useState<CallQuickReply[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  // Sync scenario selection
  const initScenario = useCallback((sc: DemoScenario) => {
    setSelectedScenario(sc);
    setScenarioPhase("idle");
    setBlockedReason(null);
    const def = DEMO_SCENARIO_DEFINITIONS[sc];

    const currentTrip = activeTripRef.current;
    if (currentTrip?.id) {
      const currentMode = currentTrip.mode;
      const currentPT = Boolean(currentTrip.premiumTatkalEnabled);
      const desiredPT = Boolean(def.premiumTatkalEnabled);
      if (currentMode !== def.initialMode || currentPT !== desiredPT) {
        updateTripRef.current(currentTrip.id, {
          mode: def.initialMode,
          premiumTatkalEnabled: desiredPT,
        } as any);
      }
    }
    const journey = optionalJourneyRef.current;
    if (journey?.setMode && journey.mode !== def.initialMode) {
      journey.setMode(def.initialMode);
    }

    setTimeline({
      primary: "ready",
      backup: "armed",
      premiumTatkal: def.premiumTatkalEnabled ? "available" : "none",
    });
  }, []);

  useEffect(() => {
    if (
      initialScenario &&
      (HEADLINE_SCENARIOS as readonly string[]).includes(initialScenario) &&
      lastAppliedScenarioRef.current !== initialScenario
    ) {
      lastAppliedScenarioRef.current = initialScenario;
      initScenario(initialScenario);
    }
  }, [initialScenario, initScenario]);

  // Clean up clock on unmount
  useEffect(() => {
    return () => {
      if (clockRef.current) {
        clockRef.current.destroy();
        clockRef.current = null;
      }
    };
  }, []);

  // Execute Step 1: T-5 Proactive Voice Briefing Call
  const triggerTMinus5Call = useCallback(() => {
    setScenarioPhase("t_minus_5_briefing");
    const tripToBrief = activeTrip || {
      from: fromName,
      to: toName,
      fromCode,
      toCode,
      dateLabel: "Tomorrow",
      primary: { trainName: primaryTrainName, fare: farePerPassenger },
      backup: { trainName: backupTrainName, fare: farePerPassenger },
      travelClass: "3A",
      travellerIds: activePassengers.map((p) => p.id),
      tatkalOpensAtLabel: "10:00 AM",
      mode: currentMode,
      premiumTatkalEnabled: selectedScenario === "assisted_to_permissioned_premium_tatkal_success",
    } as any;

    const briefing = buildTMinus5Briefing({
      trip: tripToBrief,
      travellers: activePassengers,
      wallet,
      maxAuthorizedSpend,
      maxPremiumTatkalFare,
      ptEstimatedFare: ptEstimatePerPax,
    });

    setCallBriefing(briefing);

    const currentClass = activeTrip?.travelClass || "3A";

    if (selectedScenario === "assisted_briefing") {
      // SCENARIO 1: Assisted Briefing — User remains available, remain Assisted (§2)
      setCallSubtitle("Your Tatkal briefing is ready. Will you be available to approve the booking?");
      setCallQuickReplies([
        {
          label: "Yes, I'll be available.",
          agentResponse:
            "Wonderful! I have your train details locked in and I'll keep everything primed for your 1-tap approval right when the window opens. Are there any other questions you have about the booking, or would you like to make any last-minute changes?",
          followUpReplies: [
            {
              label: "No questions, all set! Thank you.",
              agentResponse:
                "Bahut badhiya! Thank you so much for your trust. Have a wonderful day ahead, and I'll keep a sharp watch for your booking. Goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
                logActivity([
                  {
                    kind: "agent_reasoning",
                    text: "User confirmed availability and readiness. Copilot remains in Assisted mode (waiting for 1-tap approval at window open).",
                  },
                ]);
              },
            },
            {
              label: "Can you confirm my passenger and boarding details?",
              agentResponse: `All set! You have ${activePassengers.length} passenger${activePassengers.length > 1 ? "s" : ""} travelling from ${fromName} to ${toName} in class ${currentClass} on ${primaryTrainName}. Everything is verified. Thank you, have a pleasant journey, and goodbye!`,
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
                logActivity([
                  {
                    kind: "agent_reasoning",
                    text: "Passenger and boarding details re-verified over call. Copilot remains in Assisted mode.",
                  },
                ]);
              },
            },
            {
              label: "Everything looks great. Have a nice day!",
              agentResponse:
                "Thank you! Have a fantastic day ahead, take care, and I will see you right at booking time. Goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
              },
            },
          ],
        },
        {
          label: "No, I'm outside. I won't be able to log in.",
          agentResponse:
            "Understood, don't worry at all! I can take over and execute the booking autonomously so you don't miss out, but I will need your one-time permission. Would you like me to open the authorization screen for you right now?",
          followUpReplies: [
            {
              label: "Yes, please take over and open permission.",
              agentResponse:
                "Opening authorization right away. Thank you so much, have a wonderful day ahead, and I will handle everything. Goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("permission_requested");
                setPermissionModalOpen(true);
              },
            },
            {
              label: "Thank you Aarav, go ahead.",
              agentResponse:
                "My pleasure! Setting up permissioned mode now. Have a great day, take care, and goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("permission_requested");
                setPermissionModalOpen(true);
              },
            },
          ],
        },
      ]);
    } else {
      // SCENARIOS 2 & 3: User outside, Copilot asks for permission to switch to Permissioned mode (§2)
      setCallSubtitle("Your Tatkal briefing is ready. Will you be available to approve the booking?");
      setCallQuickReplies([
        {
          label: "No, I'm outside. I won't be able to log in.",
          agentResponse:
            "Understood, don't worry at all! I can take over and execute the booking autonomously so you don't miss out, but I will need your one-time permission. Would you like me to open the authorization screen for you right now?",
          followUpReplies: [
            {
              label: "Yes, please take over and open permission.",
              agentResponse:
                "Opening authorization right away. Thank you so much, have a wonderful day ahead, and I will secure your tickets. Goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("permission_requested");
                setPermissionModalOpen(true);
              },
            },
            {
              label: "Thank you Aarav, go ahead.",
              agentResponse:
                "My pleasure! Setting up permissioned mode now. Have a great day, take care, and goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("permission_requested");
                setPermissionModalOpen(true);
              },
            },
          ],
        },
        {
          label: "Yes, I'll be available.",
          agentResponse:
            "Wonderful! I'll keep everything primed and ready for your 1-tap approval at 10:00 AM. Are there any other questions you have about the booking, or would you like to make any last-minute changes?",
          followUpReplies: [
            {
              label: "No questions, all set! Thank you.",
              agentResponse:
                "Bahut badhiya! Thank you so much. Have a wonderful day ahead, and I'll keep a sharp watch for you. Goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
              },
            },
            {
              label: "Can you confirm my passenger and boarding details?",
              agentResponse: `All confirmed! You have ${activePassengers.length} passenger${activePassengers.length > 1 ? "s" : ""} from ${fromName} to ${toName} in class ${currentClass}. Have a fantastic day ahead, and goodbye!`,
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
              },
            },
            {
              label: "No changes needed. Have a nice day!",
              agentResponse:
                "Thank you! Have a wonderful day ahead, take care, and goodbye!",
              onSelect: () => {
                setIncomingCallOpen(false);
                setScenarioPhase("idle");
              },
            },
          ],
        },
      ]);
    }

    setIncomingCallOpen(true);
  }, [
    activeTrip,
    fromName,
    toName,
    fromCode,
    toCode,
    primaryTrainName,
    backupTrainName,
    farePerPassenger,
    activePassengers,
    currentMode,
    selectedScenario,
    wallet,
    maxAuthorizedSpend,
    maxPremiumTatkalFare,
    ptEstimatePerPax,
    logActivity,
  ]);

  // Handle explicit authorization from PermissionRequestModal
  const handleAuthorizePermission = useCallback(() => {
    setPermissionModalOpen(false);
    if (activeTrip?.id) {
      updateTrip(activeTrip.id, { mode: "auto" });
    }
    if (optionalJourney?.setMode) {
      optionalJourney.setMode("auto");
    }

    logActivity([
      {
        kind: "authorized",
        text: "Permission escalated: authorizationMode changed from assisted to auto. Reason: explicit user confirmation via Permission Request dialog.",
        metadata: { action: "authorize_copilot" },
      },
    ]);

    setScenarioPhase("authorized");
  }, [activeTrip?.id, optionalJourney, updateTrip, logActivity]);

  // Execute T=0 Booking Window
  const executeBookingAtTZero = useCallback(() => {
    setScenarioPhase("t_zero_attempt");
    setBlockedReason(null);

    // Scenario 1: Assisted mode suppresses autonomous booking (§2)
    if (selectedScenario === "assisted_briefing" || currentMode === "assisted") {
      logActivity([
        {
          kind: "agent_reasoning",
          text: "Tatkal window is OPEN. Copilot in Assisted mode: autonomous booking suppressed. Waiting for passenger 1-tap approval.",
        },
      ]);
      setScenarioPhase("idle");
      return;
    }

    // Scenarios 2 & 3: Autonomous execution under Permissioned mode
    setTimeline((prev) => ({ ...prev, primary: "attempting" }));

    setTimeout(() => {
      // Primary fails deterministically
      setTimeline((prev) => ({
        ...prev,
        primary: "unavailable",
        primaryReason: "IRCTC Tatkal Quota exhausted at 10:00:00.412",
        backup: "attempting",
      }));
      setScenarioPhase("primary_failed");

      if (selectedScenario === "assisted_to_permissioned_premium_tatkal_success") {
        // Scenario 3: Backup ALSO fails, then evaluates PT (§2, §10)
        setTimeout(() => {
          setTimeline((prev) => ({
            ...prev,
            backup: "unavailable",
            backupReason: "Waitlist WL 18 exceeds confirmed threshold",
            premiumTatkal: "evaluating",
          }));
          setScenarioPhase("pt_evaluating");

          // REAL GUARD EVALUATION FOR PT (§2, §6, §9)
          const ptContext = {
            trip: {
              ...(activeTrip || {}),
              from: fromName,
              to: toName,
              primary: { trainName: primaryTrainName, fare: farePerPassenger },
              backup: { trainName: backupTrainName, fare: farePerPassenger },
              travelClass: "3A",
              travellerIds: activePassengers.map((p) => p.id),
              mode: currentMode,
              premiumTatkalEnabled: true,
            } as any,
            travellers: activePassengers,
            wallet,
            maxAuthorizedSpend,
            maxPremiumTatkalFare,
            ptEstimatedFare: ptEstimatePerPax,
          };

          const guard = evaluatePremiumTatkalGuard(ptContext);

          if (!guard.allowed) {
            // Real guard failed: DO NOT fabricate success!
            setTimeline((prev) => ({
              ...prev,
              premiumTatkal: "blocked",
              ptReason: guard.reason,
            }));
            setBlockedReason(guard.reason || "Blocked by Quota Policy.");
            setScenarioPhase("blocked");

            logActivity([
              {
                kind: "agent_reasoning",
                text: `Autonomous Premium Tatkal BLOCKED: ${guard.reason}`,
              },
            ]);
            return;
          }

          // Guard passed! Confirm Premium Tatkal
          setTimeout(() => {
            setTimeline((prev) => ({
              ...prev,
              premiumTatkal: "confirmed",
              ptReason: `PNR 831-9284719 Confirmed · Coach B3 Berth 17, 18 (${formatFare(estimatedPtTotal)})`,
            }));
            setScenarioPhase("pt_confirmed");

            if (activeTrip?.id) {
              updateTrip(activeTrip.id, {
                status: "upcoming",
                agentState: "confirmed",
                trainName: `${backupTrainName} (Premium Tatkal)`,
                fare: estimatedPtTotal,
                booking: {
                  status: "confirmed",
                  pnr: "831-9284719",
                  bookedAt: new Date().toISOString(),
                } as any,
              });
            }

            logActivity([
              {
                kind: "confirmed",
                text: `Premium Tatkal booking confirmed on ${backupTrainName} for ${activePassengers.map((p) => p.name).join(", ")}. PNR: 831-9284719.`,
              },
            ]);

            // Milestone Call
            setTimeout(() => {
              setCallSubtitle("Your primary and backup options weren't available. I used Premium Tatkal within your authorized limit and secured the booking.");
              setCallBriefing("Your primary and backup options weren't available. I used Premium Tatkal within your authorized limit and secured the booking. PNR is 831-9284719.");
              setCallQuickReplies([
                {
                  label: "View Confirmed Ticket in My Trips",
                  agentResponse:
                    "Thank you for trusting Tatkal Copilot! Your journey is confirmed with PNR 831-9284719. Have a wonderful journey and a great day ahead. Goodbye!",
                  onSelect: () => {
                    setIncomingCallOpen(false);
                    router.push("/app/trips");
                  },
                },
              ]);
              setIncomingCallOpen(true);
            }, 600);
          }, 1000);
        }, 1000);
      } else {
        // Scenario 2: Backup succeeds (§2)
        setTimeout(() => {
          setTimeline((prev) => ({
            ...prev,
            backup: "confirmed",
            backupReason: `PNR 284-9182741 Confirmed · Coach B4 Berth 21, 24 (${formatFare(totalFare)})`,
          }));
          setScenarioPhase("backup_confirmed");

          if (activeTrip?.id) {
            updateTrip(activeTrip.id, {
              status: "upcoming",
              agentState: "confirmed",
              trainName: backupTrainName,
              fare: totalFare,
              booking: {
                status: "confirmed",
                pnr: "284-9182741",
                bookedAt: new Date().toISOString(),
              } as any,
            });
          }

          logActivity([
            {
              kind: "confirmed",
              text: `Backup booking confirmed on ${backupTrainName} for ${activePassengers.map((p) => p.name).join(", ")}. PNR: 284-9182741.`,
            },
          ]);

          // Milestone Call
          setTimeout(() => {
            setCallSubtitle("Your primary train wasn't available, so I secured your backup. Your booking is confirmed.");
            setCallBriefing("Your primary train wasn't available, so I secured your backup. Your booking is confirmed with PNR 284-9182741.");
            setCallQuickReplies([
              {
                label: "View Confirmed Ticket in My Trips",
                agentResponse:
                  "Thank you so much for booking with Tatkal Copilot! Your tickets are confirmed with PNR 284-9182741. Have a safe journey and a fantastic day ahead. Goodbye!",
                onSelect: () => {
                  setIncomingCallOpen(false);
                  router.push("/app/trips");
                },
              },
            ]);
            setIncomingCallOpen(true);
          }, 600);
        }, 1200);
      }
    }, 900);
  }, [
    selectedScenario,
    currentMode,
    activeTrip,
    fromName,
    toName,
    primaryTrainName,
    backupTrainName,
    farePerPassenger,
    activePassengers,
    wallet,
    maxAuthorizedSpend,
    maxPremiumTatkalFare,
    ptEstimatePerPax,
    estimatedPtTotal,
    totalFare,
    updateTrip,
    logActivity,
    router,
  ]);

  // Demo Clock Runner: Automatically triggers T-5 proactive call (§4)
  const handleStartDemoRun = useCallback(() => {
    if (clockRef.current) {
      clockRef.current.destroy();
    }

    const clock = new DemoClock(
      {
        onBeat: async (beat, index) => {
          setCurrentBeat(beat);
          setBeatIndex(index);

          // AT T-5 MINUTES (Beat index 3 / 05:00 / user_inactive): AUTOMATICALLY TRIGGER CALL!
          if (index === 3 || beat.secondsRemaining === 5) {
            clock.pause();
            setClockStatus("paused");
            triggerTMinus5Call();
          } else if (index === 4 || beat.secondsRemaining === 0) {
            // AT T=0 TATKAL OPEN: AUTOMATICALLY EXECUTE BOOKING WINDOW!
            clock.pause();
            setClockStatus("paused");
            executeBookingAtTZero();
          }
        },
        onComplete: () => {
          setClockStatus("complete");
        },
        onStatusChange: (status) => {
          setClockStatus(status);
        },
      },
      1800 // comfortable, natural pacing per beat
    );

    clockRef.current = clock;
    clock.start();
  }, [triggerTMinus5Call, executeBookingAtTZero]);

  // Developer Fast-Forward controls (§4, §12)
  const handleSkipToTMinus5 = useCallback(() => {
    if (clockRef.current) clockRef.current.pause();
    setCurrentBeat(DEMO_ENVIRONMENT_TIMELINE[3]);
    setBeatIndex(3);
    triggerTMinus5Call();
  }, [triggerTMinus5Call]);

  const handleSkipToTZero = useCallback(() => {
    if (clockRef.current) clockRef.current.pause();
    setCurrentBeat(DEMO_ENVIRONMENT_TIMELINE[4]);
    setBeatIndex(4);
    executeBookingAtTZero();
  }, [executeBookingAtTZero]);

  // Reset demo state cleanly (§14)
  const resetDemoState = useCallback(() => {
    if (clockRef.current) {
      clockRef.current.destroy();
      clockRef.current = null;
    }
    setClockStatus("idle");
    setCurrentBeat(null);
    setBeatIndex(0);
    lastAppliedScenarioRef.current = selectedScenario;
    initScenario(selectedScenario);
    setScenarioPhase("idle");
    setBlockedReason(null);
    setIncomingCallOpen(false);
    setPermissionModalOpen(false);
  }, [initScenario, selectedScenario]);

  // Dynamic countdown display from clock or wall-clock
  const displayHours = currentBeat ? "00" : String(timeLeft.hours).padStart(2, "0");
  const displayMinutes = currentBeat
    ? currentBeat.countdownLabel.split(":")[0] || "05"
    : String(timeLeft.minutes).padStart(2, "0");
  const displaySeconds = currentBeat
    ? currentBeat.countdownLabel.split(":")[1] || "00"
    : String(timeLeft.seconds).padStart(2, "0");

  const phases = [
    {
      step: "01",
      title: "Pre-flight Readiness Verification",
      time: "Tonight 10:00 PM",
      desc: "Validates pre-flight passenger details, quota eligibility, and payment readiness.",
      status: "Scheduled",
    },
    {
      step: "02",
      title: "Proactive Briefing Call (Aarav)",
      time: "Tomorrow 09:55:00 AM",
      desc: "At T-5 min: Copilot initiates proactive voice briefing to verify passenger readiness and booking authority.",
      status: "Armed",
    },
    {
      step: "03",
      title: "Automated Strategy Execution",
      time: "Tomorrow 10:00:00 AM",
      desc: "Executes primary quota attempt; auto-escalates to prepared backup or Premium Tatkal if authorized.",
      status: "Ready",
    },
    {
      step: "04",
      title: "1-Tap UPI / Wallet Mandate Settlement",
      time: "Tomorrow 10:00:18 AM",
      desc: `Push notification dispatched or Rail Wallet auto-settlement for ${formatFare(totalFare)}.`,
      status: "Auto-Prompt",
    },
    {
      step: "05",
      title: "Confirmed PNR Dispatched to WhatsApp",
      time: "Tomorrow 10:00:25 AM",
      desc: "Official IRCTC PDF ticket and confirmed berth numbers delivered directly to WhatsApp & SMS.",
      status: "Auto-Dispatch",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Tag & Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>MISSION CONTROL · TATKAL TIMER ACTIVE · STANDBY WATCH</span>
        </div>

        {/* Demo Mode & Live Data Disclosure (§13) */}
        <div className="flex items-center gap-3 font-mono text-[0.75rem] text-ink-soft">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Live Railway Search Active
          </span>
          <span>·</span>
          <span className="rounded bg-surface-muted px-2 py-0.5 border border-line text-[0.7rem]">
            Simulated Transaction Layer for Demo
          </span>
          <span>·</span>
          <span>Slot: AC Tatkal 10:00 AM</span>
        </div>
      </div>

      {/* Main Headline */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink font-[family-name:var(--font-outfit)]">
          “Badhai ho! Aapka Tatkal booking assistant activate ho gaya hai.”
        </h1>
        <p className="text-sm text-ink-soft max-w-3xl leading-relaxed">
          Sit back and relax. Aarav from Tatkal Copilot will call you 5 minutes before 10:00 AM
          with a concise briefing, verify your readiness, and execute your authorized booking strategy.
        </p>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Countdown Timer, Copilot Status, Strategy Timeline & Blueprint (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Giant Atomic Countdown Timer Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white p-6 sm:p-7 shadow-xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">
                  <Clock className="h-4 w-4 animate-pulse" />
                  <span>Next Tatkal AC Window Opens In</span>
                </div>
                <span className="font-mono text-[0.7rem] bg-white/10 px-2.5 py-0.5 rounded-full text-slate-300">
                  {clockStatus === "running" ? `Demo Clock Active (Beat ${beatIndex + 1}/6)` : "NTP Atomic Drift ±1.4ms"}
                </span>
              </div>

              {/* High-Contrast Numeric Blocks */}
              <div className="grid grid-cols-3 gap-3 text-center py-2">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
                  <div className="font-mono text-3xl sm:text-5xl font-black text-white tracking-tight">
                    {displayHours}
                  </div>
                  <div className="text-[0.65rem] sm:text-[0.75rem] font-bold text-slate-400 tracking-wider uppercase mt-1">
                    Hours
                  </div>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
                  <div className="font-mono text-3xl sm:text-5xl font-black text-white tracking-tight">
                    {displayMinutes}
                  </div>
                  <div className="text-[0.65rem] sm:text-[0.75rem] font-bold text-slate-400 tracking-wider uppercase mt-1">
                    Minutes
                  </div>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
                  <div className="font-mono text-3xl sm:text-5xl font-black text-emerald-400 tracking-tight">
                    {displaySeconds}
                  </div>
                  <div className="text-[0.65rem] sm:text-[0.75rem] font-bold text-slate-400 tracking-wider uppercase mt-1">
                    Seconds
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-white/10">
                <span className="flex items-center gap-1.5">
                  <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                  {currentBeat ? currentBeat.description : "Target: Tomorrow 10:00:00 AM IST"}
                </span>
                <span className="font-mono text-emerald-400 font-semibold">
                  Daemon: {clockStatus === "running" ? "ACTIVE_CLOCK" : "STANDBY_ARMED"}
                </span>
              </div>
            </div>
          </div>

          {/* COPILOT STATUS & NEXT ACTION (§1, §2, §7) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[0.68rem] uppercase font-bold text-ink-soft tracking-wider">
                    Copilot Status
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        currentMode === "auto" ? "bg-confirm animate-pulse" : "bg-caution"
                      }`}
                    />
                    <h3 className="text-sm font-bold text-ink">
                      {currentMode === "auto"
                        ? "Permissioned · Authorized by you"
                        : "Assisted · Waiting for your approval"}
                    </h3>
                  </div>
                </div>
              </div>

              {currentMode === "assisted" && (
                <button
                  type="button"
                  onClick={() => setPermissionModalOpen(true)}
                  className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Grant Permission</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Next Action Box */}
            <div className="p-3.5 rounded-xl bg-surface-muted/50 border border-line/70 space-y-2">
              <span className="text-[0.7rem] uppercase tracking-wider font-bold text-ink-soft block">
                Next Action Workflow
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.7rem] font-bold text-brand bg-brand-soft px-1.5 py-0.5 rounded">
                    T-5 Min
                  </span>
                  <span>Proactive call from Aarav with booking briefing</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.7rem] font-bold text-confirm bg-confirm-soft px-1.5 py-0.5 rounded">
                    T=0
                  </span>
                  <span>
                    {currentMode === "auto"
                      ? "Attempt primary → auto-switch to backup / PT"
                      : "Waiting for your 1-tap manual approval"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STRATEGY TIMELINE (§7, §10) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand" />
                  BOOKING STRATEGY
                </h3>
                <p className="text-xs text-ink-soft">Deterministic failover tree</p>
              </div>
              <span className="font-mono text-[0.7rem] text-ink-soft">
                Live State Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 01 Primary Strategy */}
              <div className="p-3 rounded-xl border border-line/70 bg-surface-muted/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] uppercase tracking-wider font-bold text-ink-soft">
                    01 Primary
                  </span>
                  <span
                    className={cn(
                      "text-[0.65rem] font-bold px-1.5 py-0.5 rounded uppercase font-mono",
                      timeline.primary === "confirmed" && "bg-confirm-soft text-confirm",
                      timeline.primary === "attempting" && "bg-brand-soft text-brand animate-pulse",
                      timeline.primary === "unavailable" && "bg-rose-500/10 text-rose-500",
                      timeline.primary === "ready" && "bg-surface-muted text-ink-soft"
                    )}
                  >
                    {timeline.primary === "unavailable" ? "✕" : timeline.primary}
                  </span>
                </div>
                <div className="text-xs font-bold text-ink truncate">
                  {primaryTrainName}
                </div>
                {timeline.primaryReason && (
                  <p className="text-[0.68rem] text-rose-500 leading-tight">
                    {timeline.primaryReason}
                  </p>
                )}
              </div>

              {/* 02 Prepared Backup */}
              <div className="p-3 rounded-xl border border-line/70 bg-surface-muted/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] uppercase tracking-wider font-bold text-ink-soft">
                    02 Backup
                  </span>
                  <span
                    className={cn(
                      "text-[0.65rem] font-bold px-1.5 py-0.5 rounded uppercase font-mono",
                      timeline.backup === "confirmed" && "bg-confirm-soft text-confirm",
                      timeline.backup === "attempting" && "bg-brand-soft text-brand animate-pulse",
                      timeline.backup === "unavailable" && "bg-rose-500/10 text-rose-500",
                      timeline.backup === "armed" && "bg-caution-soft text-caution"
                    )}
                  >
                    {timeline.backup === "unavailable" ? "✕" : timeline.backup === "confirmed" ? "✓" : timeline.backup}
                  </span>
                </div>
                <div className="text-xs font-bold text-ink truncate">
                  {backupTrainName}
                </div>
                {timeline.backupReason && (
                  <p
                    className={cn(
                      "text-[0.68rem] leading-tight",
                      timeline.backup === "confirmed" ? "text-confirm font-bold" : "text-rose-500"
                    )}
                  >
                    {timeline.backupReason}
                  </p>
                )}
              </div>

              {/* 03 Premium Tatkal */}
              <div className="p-3 rounded-xl border border-line/70 bg-surface-muted/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[0.7rem] uppercase tracking-wider font-bold text-ink-soft">
                    03 Premium Tatkal
                  </span>
                  <span
                    className={cn(
                      "text-[0.65rem] font-bold px-1.5 py-0.5 rounded uppercase font-mono",
                      timeline.premiumTatkal === "confirmed" && "bg-confirm-soft text-confirm",
                      timeline.premiumTatkal === "evaluating" && "bg-brand-soft text-brand animate-pulse",
                      timeline.premiumTatkal === "blocked" && "bg-rose-500/10 text-rose-500",
                      timeline.premiumTatkal === "available" && "bg-surface-muted text-ink-soft",
                      timeline.premiumTatkal === "none" && "bg-surface-muted text-ink-soft opacity-50"
                    )}
                  >
                    {timeline.premiumTatkal === "none"
                      ? "Disabled"
                      : timeline.premiumTatkal === "confirmed"
                      ? "✓"
                      : timeline.premiumTatkal === "blocked"
                      ? "✕"
                      : timeline.premiumTatkal}
                  </span>
                </div>
                <div className="text-xs font-bold text-ink truncate">
                  {selectedScenario === "assisted_to_permissioned_premium_tatkal_success"
                    ? `~${formatFare(estimatedPtTotal)} estimated`
                    : "Tertiary Standby"}
                </div>
                {selectedScenario === "assisted_to_permissioned_premium_tatkal_success" && (
                  <div className="text-[0.65rem] text-confirm font-medium flex flex-wrap gap-1">
                    <span>✓ Wallet ready</span>
                    <span>✓ Within limit</span>
                  </div>
                )}
                {timeline.ptReason && (
                  <p
                    className={cn(
                      "text-[0.68rem] leading-tight",
                      timeline.premiumTatkal === "confirmed" ? "text-confirm font-bold" : "text-rose-500"
                    )}
                  >
                    {timeline.ptReason}
                  </p>
                )}
              </div>
            </div>

            {blockedReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Autonomous Execution Guard Blocked:</strong> {blockedReason}
                </div>
              </div>
            )}
          </div>

          {/* Delegated Booking Request Card */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-caution" />
                  Delegated Booking Blueprint
                </h3>
                <p className="text-xs text-ink-soft">
                  Stored in local enclave with cryptographic signature
                </p>
              </div>
              <span className="rounded-full bg-caution-soft px-3 py-1 text-xs font-bold text-caution">
                TATKAL QUOTA (TQ)
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {/* Route line */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted/50 border border-line/60">
                <div>
                  <span className="text-[0.7rem] text-ink-soft uppercase tracking-wider font-bold">
                    Journey Corridor
                  </span>
                  <div className="font-bold text-sm text-ink mt-0.5">
                    {fromName} ({fromCode}) → {toName} ({toCode})
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[0.7rem] text-ink-soft uppercase tracking-wider font-bold">
                    Departure / Arrival
                  </span>
                  <div className="font-bold text-sm text-ink mt-0.5">
                    {departureDisplay} → {arrivalDisplay}
                  </div>
                </div>
              </div>

              {/* Primary Train & Fallback (Unsupported claims removed per §12) */}
              <div className="p-3.5 rounded-xl border border-line/60 bg-surface-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-confirm" />
                    <span className="text-sm font-bold text-ink">
                      {primaryTrainName}
                    </span>
                    <span className="rounded bg-confirm-soft px-1.5 py-0.5 text-[0.65rem] font-bold text-confirm">
                      Primary Target
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-confirm">
                    High Tatkal suitability
                  </span>
                </div>
                {autoFallbackEnabled && (
                  <p className="text-xs text-ink-soft flex items-center gap-1.5 pl-4.5">
                    <Zap className="h-3 w-3 text-caution" />
                    Auto-fallback to {backupTrainName} armed (400ms failover)
                  </p>
                )}
              </div>

              {/* Passenger & Staged Payment details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-surface-muted/50 border border-line/60">
                  <span className="text-[0.68rem] text-ink-soft uppercase tracking-wider font-bold">
                    Confirmed Passengers ({activePassengers.length})
                  </span>
                  <div className="text-xs font-semibold text-ink mt-1 space-y-0.5">
                    {activePassengers.map((p) => (
                      <div key={p.id}>{p.name} ({p.age}, {p.gender}) · {p.berthPreference ? `${p.berthPreference} Berth` : "Lower Berth"}</div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-muted/50 border border-line/60">
                  <span className="text-[0.68rem] text-ink-soft uppercase tracking-wider font-bold">
                    Staged Payment
                  </span>
                  <div className="text-xs font-semibold text-ink mt-1">
                    Google Pay UPI Mandate
                  </div>
                  <div className="text-[0.7rem] text-confirm mt-0.5 font-semibold">
                    Auto-prompt ready ({formatFare(totalFare)})
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Execution Plan: What Happens Next (5-Phase Timeline) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Layers className="h-4 w-4 text-brand" />
              Execution Plan: What Happens Next
            </h3>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
              {phases.map((phase, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-6 top-0.5 h-4 w-4 rounded-full bg-surface border-2 border-confirm flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-confirm" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-ink">
                        Phase {phase.step}: {phase.title}
                      </h4>
                      <span className="font-mono text-[0.7rem] font-semibold text-confirm bg-confirm-soft px-2 py-0.5 rounded">
                        {phase.time}
                      </span>
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      {phase.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Aarav Tatkal Copilot Card, Payment Readiness, Unwind & Scenario Runner (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Aarav · Tatkal Copilot Card (Consistent Identity §11) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-full overflow-hidden border-2 border-confirm/50 shrink-0">
                <Image
                  src="/aarav-namaste.jpg"
                  alt="Aarav · Tatkal Copilot"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">
                    Aarav
                  </h3>
                  <span className="flex h-2 w-2 rounded-full bg-confirm animate-pulse" />
                </div>
                <p className="text-[0.75rem] text-confirm font-medium">
                  Tatkal Copilot · Watching your booking window
                </p>
              </div>
            </div>

            <div className="relative rounded-xl bg-surface-muted/60 p-4 text-xs text-ink leading-relaxed border border-line/70">
              <p>
                “Aap aaram se soiye! Kal subah 09:55 AM pe main proactively call karunga,
                aur 10:00 AM par bina kisi deri ke aapke authorized plan ko execute kar dunga.”
              </p>
              <div className="mt-3 flex items-center justify-between text-[0.7rem] text-ink-soft border-t border-line/60 pt-2 font-mono">
                <span>WhatsApp Target: +91 98765 43210</span>
                <span className="text-confirm font-bold">READY</span>
              </div>
            </div>

            {/* Proactive Calling Agent */}
            <div className="pt-1">
              <CallButton className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-bold text-ink hover:bg-surface-muted transition shadow-xs cursor-pointer" />
            </div>
          </div>

          {/* PAYMENT & WALLET READINESS SECTION (§5, §9) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">PAYMENT READINESS</h3>
                  <p className="text-[0.7rem] text-ink-soft">Rail Wallet & spend authorization check</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddMoneyOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-brand-soft hover:bg-brand-soft/80 text-brand text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Add money</span>
              </button>
            </div>

            {/* Balance & Estimates */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-surface-muted/50 border border-line/70">
                <span className="text-[0.68rem] uppercase font-bold text-ink-soft">Rail Wallet</span>
                <div className="font-mono text-base font-bold text-ink mt-0.5">
                  {formatFare(wallet.balance)}
                </div>
                <span className="text-[0.65rem] text-ink-soft">available</span>
              </div>

              <div className="p-3 rounded-xl bg-surface-muted/50 border border-line/70">
                <span className="text-[0.68rem] uppercase font-bold text-ink-soft">Authorized Maximum</span>
                <div className="font-mono text-base font-bold text-ink mt-0.5">
                  {formatFare(maxAuthorizedSpend)}
                </div>
                <span className="text-[0.65rem] text-ink-soft">spend ceiling</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-muted/30 border border-line/60 text-xs space-y-1">
              <div className="flex justify-between text-ink-soft">
                <span>Premium Tatkal estimate:</span>
                <span className="font-mono text-ink font-semibold">{formatFare(ptEstimatePerPax)} / pax</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Estimated total ({paxCount} pax):</span>
                <span className="font-mono text-ink font-bold">~{formatFare(estimatedPtTotal)}</span>
              </div>
            </div>

            {/* Independent Status Badges (§5, §9) */}
            <div className="space-y-2 pt-1">
              {/* Constraint 1: Wallet Balance */}
              <div
                className={cn(
                  "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                  isWalletSufficient
                    ? "bg-confirm-soft border-confirm/30 text-confirm font-semibold"
                    : "bg-caution-soft border-caution/30 text-caution font-semibold"
                )}
              >
                {isWalletSufficient ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Wallet balance sufficient</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Wallet short by {formatFare(walletShortfall)}</span>
                  </>
                )}
              </div>

              {/* Constraint 2: Spend Authorization */}
              <div
                className={cn(
                  "p-2.5 rounded-xl border text-xs flex items-center gap-2",
                  isWithinSpendLimit
                    ? "bg-confirm-soft border-confirm/30 text-confirm font-semibold"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-500 font-semibold"
                )}
              >
                {isWithinSpendLimit ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Within authorization limit</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Exceeds authorized maximum</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* UNWIND & BREATHE Reassurance Card (Unsupported claims replaced per §12) */}
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-confirm">
              <HeartHandshake className="h-5 w-5" />
              <h3 className="text-sm font-bold tracking-wider uppercase font-[family-name:var(--font-outfit)]">
                Unwind & Breathe
              </h3>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              No need to wake up at 09:55 AM frantically refreshing screens or battling CAPTCHA failures.
              Our autonomous failover daemon executes your strategy within strict authorization boundaries.
            </p>

            <div className="space-y-2 pt-2 border-t border-line text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Failover Engine:</span>
                <span className="font-bold text-ink">
                  {autoFallbackEnabled ? "Prepared Backup Ready" : "Single Train"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Search & Booking Layer:</span>
                <span className="font-bold text-confirm">
                  Live Search · Simulated Demo Gateway
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Cancellation Policy:</span>
                <span className="font-bold text-ink">
                  Standard Railway Quota Rules
                </span>
              </div>
            </div>
          </div>

          {/* DEMO SCENARIO RUNNER & AUTOMATIC DEMO CLOCK (§1, §2, §4, §14) */}
          <div className="rounded-2xl border border-brand/30 bg-brand-soft/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-brand" />
                Demo Scenario Controller
              </span>
              <button
                type="button"
                onClick={resetDemoState}
                className="text-[0.7rem] font-bold text-ink-soft hover:text-ink flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Headline Scenario Selector (§2, §3) */}
            <div className="space-y-2">
              <label className="text-[0.7rem] uppercase font-bold text-ink-soft block">
                Select Headline Scenario
              </label>
              <div className="flex flex-col gap-2">
                {HEADLINE_SCENARIOS.map((scKey) => {
                  const def = DEMO_SCENARIO_DEFINITIONS[scKey];
                  const isSelected = selectedScenario === scKey;
                  return (
                    <button
                      key={scKey}
                      type="button"
                      onClick={() => {
                        lastAppliedScenarioRef.current = scKey;
                        initScenario(scKey);
                      }}
                      className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        isSelected
                          ? "border-brand bg-surface shadow-xs font-bold text-ink"
                          : "border-line/70 bg-surface/60 hover:bg-surface text-ink-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={isSelected ? "text-brand font-black" : "text-ink font-semibold"}>
                          {def.title}
                        </span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-brand" />}
                      </div>
                      <p className="text-[0.68rem] text-ink-soft font-normal mt-0.5">
                        {def.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Demo Execution: Automatic Demo Clock (§4) */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleStartDemoRun}
                className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-strong text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand/20"
              >
                <Play className="h-4 w-4" />
                <span>
                  {clockStatus === "running"
                    ? "Demo Clock Running (Watching window...)"
                    : "▶ Start Demo Scenario (Automatic T-5 Call)"}
                </span>
              </button>

              {/* Developer / Hackathon Fast-Forward & Debug Skips (§4) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSkipToTMinus5}
                  className="py-2 px-2.5 rounded-xl border border-line bg-surface hover:bg-surface-muted text-ink text-[0.72rem] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FastForward className="h-3 w-3 text-brand" />
                  <span>Skip to T-5 Call</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipToTZero}
                  className="py-2 px-2.5 rounded-xl border border-line bg-surface hover:bg-surface-muted text-ink text-[0.72rem] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FastForward className="h-3 w-3 text-confirm" />
                  <span>Skip to T=0 Window</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation & Sleep Peacefully CTAs */}
          <div className="space-y-2 pt-2">
            <Link
              href="/app/trips"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-confirm hover:bg-confirm/90 text-white px-6 py-3.5 text-sm font-bold shadow-md shadow-confirm/20 transition cursor-pointer"
            >
              <span>Go to My Trips · Sleep Peacefully</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={() => {
                if (optionalJourney?.goTo) {
                  optionalJourney.goTo("prepare");
                }
                router.push("/app/plan");
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface hover:bg-surface-muted px-4 py-2.5 text-xs font-semibold text-ink transition cursor-pointer shadow-xs"
            >
              Modify Blueprint or Passengers
            </button>
          </div>
        </div>
      </div>

      {/* MODALS INTEGRATION (§3, §5) */}
      <IncomingCallModal
        isOpen={incomingCallOpen}
        onDecline={() => setIncomingCallOpen(false)}
        callerName="Aarav"
        callerRole="Tatkal Copilot"
        subtitle={callSubtitle}
        briefingText={callBriefing}
        trip={activeTrip}
        quickReplies={callQuickReplies}
      />

      <PermissionRequestModal
        isOpen={permissionModalOpen}
        onAuthorize={handleAuthorizePermission}
        onDismiss={() => setPermissionModalOpen(false)}
        maxSpend={maxAuthorizedSpend}
        primaryTrainName={primaryTrainName}
        backupTrainName={backupTrainName}
        ptEligible={selectedScenario === "assisted_to_permissioned_premium_tatkal_success"}
      />

      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        recommendedTopUp={walletShortfall > 0 ? Math.ceil(walletShortfall / 500) * 500 : 2000}
      />
    </div>
  );
}
