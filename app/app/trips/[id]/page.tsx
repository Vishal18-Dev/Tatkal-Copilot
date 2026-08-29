"use client";

import { use, useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  FastForward,
  Sparkles,
  Check,
  Loader2,
  TrainFront,
  Split,
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Ticket,
  Activity as ActivityIcon,
  RefreshCw,
  Bell,
  MessageCircle,
  Mail,
  Smartphone,
  Play,
  RotateCcw,
  Send,
  Bot,
  Pause,
  AlertTriangle,
  Cpu,
  UserX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, DemoBadge } from "@/components/app/ui";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { providers, type OrchestratorStep } from "@/lib/providers";
import {
  statusMeta,
  coachFor,
  readinessFor,
  beatFor,
  nextPreBookingState,
} from "@/lib/agent";
import { TatkalAgent, type AgentObservation } from "@/lib/tatkal-agent";
import { DemoClock, type DemoEnvironmentBeat, type DemoClockStatus, DEMO_ENVIRONMENT_TIMELINE } from "@/lib/demo-clock";
import type { ProposedAgentDecision, ValidationResult } from "@/lib/action-validator";
import { cn, formatFare } from "@/lib/utils";
import type { AgentState, NotificationChannel, Trip } from "@/types";

const CHANNEL_ICON: Record<NotificationChannel, typeof Bell> = {
  "in-app": Bell,
  push: Smartphone,
  whatsapp: MessageCircle,
  email: Mail,
};

export interface DecisionTraceRecord {
  id: string;
  timestamp: string;
  observed: string;
  decision: string;
  why: string;
  action: string;
  result: string;
  source: "gpt" | "local";
  valid: boolean;
}

export default function PlanMissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getTrip, hydrated } = useStore();
  const { t } = useLang();
  const plan = getTrip(id);

  if (!hydrated) return null;
  if (!plan) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">{t("mc.notFound")}</h1>
        <p className="mt-2 text-ink-soft">{t("mc.notFoundBody")}</p>
        <Link href="/app/trips" className="mt-5 inline-block">
          <Button size="md">{t("mc.backToTrips")}</Button>
        </Link>
      </div>
    );
  }
  return <PlanMission plan={plan} />;
}

function PlanMission({ plan }: { plan: Trip }) {
  const { updateTrip, logActivity, pushNotification, travellers } = useStore();
  const { t } = useLang();
  const state = plan.agentState;
  const meta = statusMeta(state);
  const beat = beatFor(state);
  const readiness = readinessFor(plan);
  const readyCount = readiness.filter((r) => r.done).length;
  const bookedTravellers = travellers.filter((t) => plan.travellerIds.includes(t.id));

  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<OrchestratorStep[]>([]);

  // ═══════════════════════════════════════════
  //  AI Coach Chat
  // ═══════════════════════════════════════════
  const [coachMessages, setCoachMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);

  async function askCoach() {
    const msg = coachInput.trim();
    if (!msg || coachLoading) return;
    setCoachInput("");
    setCoachMessages((m) => [...m, { role: "user", text: msg }]);
    setCoachLoading(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          journeyContext: {
            agentState: plan.agentState,
            from: plan.from,
            to: plan.to,
            primaryTrain: plan.primary.trainName,
            primaryClass: plan.primary.travelClass,
            primaryConfidence: plan.primary.level,
            backupTrain: plan.backup?.trainName ?? null,
            backupConfidence: plan.backup?.level ?? null,
            backupVia: plan.backup?.via ?? null,
            tatkalOpens: plan.tatkalOpensAtLabel,
            arrivalTarget: plan.arrivalTargetLabel ?? null,
            passengerCount: plan.travellerIds.length,
            mode: plan.mode,
            bookingStatus: plan.booking?.status ?? null,
            recovered: plan.booking?.recovered ?? false,
          },
        }),
      });
      const data = await res.json();
      setCoachMessages((m) => [...m, { role: "ai", text: data.response ?? "I'm not sure how to help right now." }]);
    } catch {
      setCoachMessages((m) => [...m, { role: "ai", text: coachFor(plan.agentState, plan) }]);
    }
    setCoachLoading(false);
  }

  // ═══════════════════════════════════════════
  //  TatkalAgent + Demo Clock (v1.4 Inverted Control)
  // ═══════════════════════════════════════════
  const agentRef = useRef<TatkalAgent | null>(null);
  const clockRef = useRef<DemoClock | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoClockStatus>("idle");
  const [decisionTrace, setDecisionTrace] = useState<DecisionTraceRecord[]>([]);
  const [demoBeatIndex, setDemoBeatIndex] = useState(0);

  // Helper: execute primary booking when agent tool calls openBookingFlow()
  const executePrimaryBooking = useCallback(async () => {
    setBusy(true);
    setLog([]);
    logActivity([{ kind: "attempt_started", text: "Primary strategy attempt initiated by agent" }], plan.id);

    const { available, steps } = await providers.orchestrator.attemptPrimary(plan.primary);
    await revealSteps(steps);
    logActivity(steps.map((s) => ({ kind: s.kind, text: s.text })), plan.id);

    if (available) {
      const { record, steps: bs } = await providers.orchestrator.bookPrimary(
        plan.primary,
        bookedTravellers
      );
      await revealSteps(bs);
      finishConfirmed(record, bs);
    } else {
      logActivity([{ kind: "primary_unavailable", text: `Primary strategy failed · ${plan.primary.trainName}` }], plan.id);
      updateTrip(plan.id, { agentState: "primary_failed" });
    }
    setBusy(false);
  }, [plan, updateTrip, logActivity, bookedTravellers]);

  // Helper: execute backup booking when agent tool calls activateBackupStrategy()
  const executeBackupBooking = useCallback(async () => {
    if (!plan.backup) return;
    setBusy(true);
    setLog([]);
    logActivity([{ kind: "backup_attempted", text: `Backup strategy activated · ${plan.backup.trainName}` }], plan.id);

    const { record, steps } = await providers.orchestrator.attemptBackup(
      plan.backup,
      bookedTravellers,
      plan.primary.trainName
    );
    await revealSteps(steps);
    if (record) {
      updateTrip(plan.id, {
        booking: record,
        agentState: "confirmed",
        trainName: record.finalTrainName,
      });
      logActivity([
        ...steps.map((s) => ({ kind: s.kind, text: s.text })),
        { kind: "confirmed" as const, text: "Booking simulated successfully" },
      ], plan.id);
      pushNotification({
        title: "Ticket confirmed (demo)",
        body: `${record.finalTrainName} · PNR ${record.pnr}`,
      });
    }
    setBusy(false);
  }, [plan, updateTrip, logActivity, pushNotification, bookedTravellers]);

  // Initialize agent with booking execution callbacks
  useEffect(() => {
    agentRef.current = new TatkalAgent(plan, {
      updateTrip,
      logActivity,
      pushNotification,
      getTravellers: () => bookedTravellers,
      onExecutePrimaryBooking: executePrimaryBooking,
      onExecuteBackupBooking: executeBackupBooking,
    });
    return () => { agentRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, executePrimaryBooking, executeBackupBooking]);

  // Keep agent in sync with trip state changes
  useEffect(() => {
    agentRef.current?.updateTrip(plan);
  }, [plan]);

  /** Inverted control handleDemoBeat: DemoClock emits environmental beat → Agent observes → OpenAI decides → Action validated → Tool executed */
  const handleDemoBeat = useCallback(async (envBeat: DemoEnvironmentBeat, index: number) => {
    const agent = agentRef.current;
    if (!agent) return;

    setDemoBeatIndex(index);

    // Run full agent cycle (observe → evaluate via OpenAI → validate → act)
    const { decision, validation, executedTool } = await agent.tick(envBeat);

    // Record decision trace entry
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const traceEntry: DecisionTraceRecord = {
      id: `trace_${Date.now()}_${index}`,
      timestamp: time,
      observed: envBeat.description,
      decision: decision.action,
      why: decision.reason,
      action: decision.toolCall ? `${decision.toolCall.name}()` : "none",
      result: validation.valid
        ? (executedTool ? `Executed ${executedTool}` : "No tool execution needed")
        : `Rejected: ${validation.reason}`,
      source: decision.source,
      valid: validation.valid,
    };

    setDecisionTrace((prev) => [...prev, traceEntry]);

    // Log decision trace to activity log
    logActivity([{
      kind: "agent_reasoning",
      text: `[Decision Trace] ${decision.reason}`,
      metadata: {
        tool: decision.toolCall?.name,
        action: decision.action,
        aiGenerated: decision.source === "gpt",
        source: decision.source,
      },
    }], plan.id);
  }, [plan.id, logActivity]);

  function startDemo() {
    if (clockRef.current) clockRef.current.destroy();

    // Reset state for clean demo
    setDecisionTrace([]);
    setLog([]);
    setDemoBeatIndex(0);
    updateTrip(plan.id, {
      agentState: "scheduled",
      planNotifications: [],
      booking: undefined,
    });

    const clock = new DemoClock(
      {
        onBeat: handleDemoBeat,
        onComplete: () => {
          setDecisionTrace((prev) => [
            ...prev,
            {
              id: `trace_end_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              observed: "Demo completed",
              decision: "complete",
              why: "All environmental beats processed and agent decisions executed.",
              action: "none",
              result: "Cycle complete",
              source: "local",
              valid: true,
            },
          ]);
        },
        onStatusChange: setDemoStatus,
      },
      2500
    );
    clockRef.current = clock;
    clock.start();
  }

  function pauseDemo() {
    clockRef.current?.pause();
  }

  function resumeDemo() {
    clockRef.current?.start();
  }

  function resetDemo() {
    clockRef.current?.destroy();
    clockRef.current = null;
    setDemoStatus("idle");
    setDecisionTrace([]);
    setLog([]);
    setDemoBeatIndex(0);
    updateTrip(plan.id, {
      agentState: "scheduled",
      planNotifications: [],
      booking: undefined,
    });
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { clockRef.current?.destroy(); };
  }, []);

  // ═══════════════════════════════════════════
  //  Original Mission Control logic (preserved)
  // ═══════════════════════════════════════════

  function fastForward() {
    const next = nextPreBookingState(state);
    if (next) {
      updateTrip(plan.id, { agentState: next });
    }
  }

  async function startBooking() {
    if (busy) return;
    await executePrimaryBooking();
  }

  async function useBackup() {
    if (busy || !plan.backup) return;
    await executeBackupBooking();
  }

  function finishConfirmed(record: Trip["booking"], steps: OrchestratorStep[]) {
    if (!record) return;
    updateTrip(plan.id, {
      booking: record,
      agentState: "confirmed",
      trainName: record.finalTrainName,
    });
    logActivity(
      [
        ...steps.map((s) => ({ kind: s.kind, text: s.text })),
        { kind: "confirmed", text: "Booking simulated successfully" },
      ],
      plan.id
    );
    pushNotification({
      title: "Ticket confirmed (demo)",
      body: `${record.finalTrainName} · PNR ${record.pnr}`,
    });
    setBusy(false);
  }

  async function revealSteps(steps: OrchestratorStep[]) {
    for (const s of steps) {
      setLog((l) => [...l, s]);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  const canFastForward = !!nextPreBookingState(state) && !busy && state !== "confirmed";
  const canStartBooking =
    (state === "window_open" || state === "user_action_required") && !busy;
  const demoRunning = demoStatus === "running" || demoStatus === "paused";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/app/trips" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {t("mc.backToTrips")}
        </Link>
        <span className="inline-flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", meta.dot)} />
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", meta.dot)} />
          </span>
          <span className="font-medium text-ink">{t(meta.labelKey)}</span>
        </span>
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {plan.from} → {plan.to}
        </h1>
        <Chip tone="brand">{plan.travelClass}</Chip>
        <DemoBadge />
      </div>
      <p className="mb-6 text-ink-soft">
        {plan.dateLabel}
        {plan.arrivalTargetLabel ? ` · ${t("mc.arrive")} ${plan.arrivalTargetLabel}` : ""} ·{" "}
        {plan.travellerIds.length} {plan.travellerIds.length > 1 ? t("common.travellers") : t("common.traveller")} ·{" "}
        {plan.mode === "auto" ? t("mc.agentPermissioned") : t("mc.agentAssisted")}
      </p>

      {state === "confirmed" ? (
        <Confirmation plan={plan} travellers={bookedTravellers} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* LEFT: countdown + coach + booking action + decision trace */}
          <div className="space-y-4">
            <CountdownCard state={state} beat={beat} tatkalLabel={plan.tatkalOpensAtLabel} />

            {/* AI Coach — interactive chat */}
            <CoachCard
              defaultText={coachFor(state, plan)}
              messages={coachMessages}
              input={coachInput}
              loading={coachLoading}
              onInputChange={setCoachInput}
              onSend={askCoach}
            />

            {/* Booking area */}
            {busy || log.length > 0 ? (
              <Card className="p-5">
                <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
                  {state === "backup_attempt" ? t("mc.bookingBackup") : t("mc.booking")}
                </div>
                <ul className="space-y-2">
                  {log.map((s, i) => {
                    const bad = s.kind === "primary_unavailable" || s.kind === "failed";
                    return (
                      <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5 text-[0.92rem] text-ink">
                        <span className={cn("grid h-5 w-5 place-items-center rounded-full", bad ? "bg-danger-soft text-danger" : "bg-confirm text-white")}>
                          {bad ? <RefreshCw className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        {s.text}
                      </motion.li>
                    );
                  })}
                  {busy && (
                    <li className="flex items-center gap-2.5 text-[0.92rem] text-ink-soft">
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Loader2 className="h-4 w-4 text-brand" />
                      </motion.span>
                      {t("mc.working")}
                    </li>
                  )}
                </ul>
              </Card>
            ) : null}

            {state === "backup_recommended" && !busy && (
              <Card className="border-caution/40 bg-caution-soft/40 p-5">
                <div className="flex items-center gap-2 text-caution">
                  <Split className="h-5 w-5" />
                  <h4 className="text-sm font-semibold uppercase tracking-wide">{t("mc.primaryFailed")}</h4>
                </div>
                <p className="mt-2 text-[0.95rem] text-ink">
                  {coachFor("backup_recommended", plan)}
                </p>
                <Button size="lg" className="mt-4 w-full" onClick={useBackup}>
                  <Split className="h-5 w-5" /> {t("mc.useBackup")}
                </Button>
              </Card>
            )}

            {/* Agent Decision Trace UI (showing OBSERVED -> DECISION -> WHY -> ACTION -> RESULT) */}
            {decisionTrace.length > 0 && (
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-brand" />
                    <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{t("mc.agentDecisionTrace")}</span>
                  </div>
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.65rem] font-semibold text-brand">{t("mc.invertedControl")}</span>
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto">
                  {decisionTrace.map((trace) => (
                    <motion.div
                      key={trace.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-line bg-surface p-3 text-[0.85rem]"
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-ink-faint">
                        <span className="font-mono">{trace.timestamp}</span>
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase",
                          trace.source === "gpt" ? "bg-[#eef2ff] text-[#4338ca]" : "bg-surface-muted text-ink-faint"
                        )}>
                          {trace.source === "gpt" ? "AI Provider: OpenAI" : "AI Provider: Demo fallback"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-ink-faint uppercase text-[0.7rem] w-16 shrink-0">OBSERVED</span>
                          <span className="text-ink-soft">{trace.observed}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-brand uppercase text-[0.7rem] w-16 shrink-0">DECISION</span>
                          <span className="font-semibold text-ink">{trace.decision}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-ink-faint uppercase text-[0.7rem] w-16 shrink-0">WHY</span>
                          <span className="text-ink">{trace.why}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-ink-faint uppercase text-[0.7rem] w-16 shrink-0">ACTION</span>
                          <span className="font-mono text-xs text-brand">{trace.action}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-semibold text-confirm uppercase text-[0.7rem] w-16 shrink-0">RESULT</span>
                          <span className="text-confirm font-medium">{trace.result}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {/* Demo controls */}
              {!demoRunning && (
                <Button size="lg" onClick={startDemo} className="flex-1 bg-gradient-to-r from-brand to-[#7c74f5] text-white shadow-[var(--shadow-brand)]">
                  <Play className="h-4 w-4" /> {t("mc.runDemo")}
                </Button>
              )}
              {demoStatus === "running" && (
                <Button variant="secondary" size="lg" onClick={pauseDemo} className="flex-1">
                  <Pause className="h-4 w-4" /> {t("mc.pauseDemo")}
                </Button>
              )}
              {demoStatus === "paused" && (
                <Button size="lg" onClick={resumeDemo} className="flex-1">
                  <Play className="h-4 w-4" /> {t("mc.resumeDemo")}
                </Button>
              )}
              {(demoRunning || demoStatus === "complete") && (
                <Button variant="secondary" size="lg" onClick={resetDemo}>
                  <RotateCcw className="h-4 w-4" /> {t("mc.reset")}
                </Button>
              )}
              
              {/* Simulate User Inactivity toggle for demo */}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const currentBeat = DEMO_ENVIRONMENT_TIMELINE[demoBeatIndex] || DEMO_ENVIRONMENT_TIMELINE[3];
                  const toggledBeat = { ...currentBeat, userActive: !currentBeat.userActive };
                  handleDemoBeat(toggledBeat, demoBeatIndex);
                }}
                title="Simulate passenger closing app / leaving screen"
              >
                <UserX className="h-4 w-4 text-brand" />
                Simulate Inactivity
              </Button>

              {/* Manual controls */}
              {!demoRunning && canStartBooking && (
                <Button size="lg" onClick={startBooking} className="flex-1">
                  <Ticket className="h-5 w-5" /> {t("mc.startBooking")}
                </Button>
              )}
              {!demoRunning && canFastForward && (
                <Button variant="secondary" size="lg" onClick={fastForward} className={canStartBooking ? "" : "flex-1"}>
                  <FastForward className="h-4 w-4" />
                  {beat.windowOpen ? t("mc.simulateInactive") : t("mc.fastForward")}
                </Button>
              )}
            </div>

            {/* Demo progress indicator */}
            {demoRunning && (
              <div className="flex items-center gap-2 text-sm text-ink-faint">
                <div className="flex-1 rounded-full bg-line">
                  <div
                    className="h-1.5 rounded-full bg-brand transition-all duration-500"
                    style={{ width: `${((demoBeatIndex + 1) / DEMO_ENVIRONMENT_TIMELINE.length) * 100}%` }}
                  />
                </div>
                <span className="tabular">{demoBeatIndex + 1}/{DEMO_ENVIRONMENT_TIMELINE.length}</span>
              </div>
            )}
          </div>

          {/* RIGHT: readiness + plan + notifications */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{t("mc.readiness")}</h3>
                <span className="tabular text-sm font-semibold text-confirm">{readyCount}/{readiness.length}</span>
              </div>
              <ul className="space-y-2">
                {readiness.map((r) => (
                  <li key={r.id} className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-2.5", r.done ? "border-confirm/25 bg-confirm-soft/40" : "border-line bg-surface")}>
                    <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", r.done ? "bg-confirm text-white" : "border-2 border-line-strong bg-surface")}>
                      {r.done && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <div className={cn("text-[0.92rem] font-medium", r.done ? "text-ink" : "text-ink-soft")}>{t(`mc.ready.${r.id}`)}</div>
                      <div className="text-xs text-ink-faint">{r.hint}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">{t("mc.yourPlan")}</h3>
              <Recap icon={<TrainFront className="h-4 w-4 text-brand" />} label={plan.primary.trainName} value={`${plan.primary.travelClass} · ${plan.primary.level}`} />
              <Recap icon={<MapPin className="h-4 w-4 text-brand" />} label={t("mc.boardAt")} value={plan.primary.boardingStationName} />
              {plan.backup && (
                <Recap icon={<Split className="h-4 w-4 text-caution" />} label={t("mc.backup")} value={`${plan.backup.trainName} · ${plan.backup.level}`} />
              )}
              <Recap icon={<Clock className="h-4 w-4 text-brand" />} label={t("mc.tatkalOpens")} value={plan.tatkalOpensAtLabel} />
              <Recap icon={<Users className="h-4 w-4 text-brand" />} label={t("mc.travellers")} value={bookedTravellers.map((p) => p.name.split(" ")[0]).join(", ") || "—"} />
            </Card>

            {plan.planNotifications.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">{t("mc.agentNotifications")}</h3>
                <div className="space-y-3">
                  {[...plan.planNotifications].reverse().slice(0, 6).map((n) => {
                    const Icon = CHANNEL_ICON[n.channel];
                    const isEmail = n.channel === "email";
                    const isDemo = n.deliveryStatus === "demo_generated";
                    const isUnavailable = n.deliveryStatus === "email_unavailable";

                    return (
                      <div key={n.id} className="rounded-xl border border-line bg-surface p-3 text-[0.88rem]">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold text-ink">
                            <Icon className="h-4 w-4 text-brand" />
                            {n.title}
                          </span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase",
                            isEmail && !isDemo && !isUnavailable ? "bg-confirm-soft text-confirm" :
                            isDemo ? "bg-brand-soft text-brand" :
                            isUnavailable ? "bg-caution-soft text-caution" :
                            "bg-surface-muted text-ink-faint"
                          )}>
                            {isEmail && !isDemo && !isUnavailable ? "📧 Email sent" :
                             isDemo ? "📱 Demo email generated" :
                             isUnavailable ? "⚠ Email unavailable" :
                             n.channel === "whatsapp" ? "📱 WhatsApp · Demo" :
                             "🔔 In-app notification"}
                          </span>
                        </div>
                        <p className="text-xs text-ink-soft">{n.body}</p>
                        {n.recipientEmail && (
                          <div className="mt-1 text-[0.75rem] text-ink-faint">
                            Recipient: <span className="font-mono">{n.recipientEmail}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CountdownCard({
  state,
  beat,
  tatkalLabel,
}: {
  state: AgentState;
  beat: ReturnType<typeof beatFor>;
  tatkalLabel: string;
}) {
  const { t } = useLang();
  const opening = ["scheduled", "ready", "draft", "waiting"].includes(state);
  const urgent = state === "t_minus_10";
  return (
    <Card className={cn("relative overflow-hidden p-8 text-center", beat.windowOpen ? "border-caution/40" : urgent ? "border-danger/30" : "border-brand/20")}>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="relative">
        <p className="text-sm font-medium uppercase tracking-wide text-ink-faint">
          {beat.windowOpen ? t("mc.windowIs") : opening ? t("mc.tatkalOpens") : t("mc.tatkalOpensIn")}
        </p>
        <div className={cn("tabular mt-2 text-[3.4rem] font-semibold leading-none sm:text-[4.2rem]", beat.windowOpen ? "text-caution" : urgent ? "text-danger" : "text-ink")}>
          {beat.windowOpen ? t("mc.open") : opening ? tatkalLabel : beat.countdown}
        </div>
        {opening && <p className="mt-2 text-sm text-ink-faint">{t("mc.tomorrowWatching")}</p>}
      </div>
    </Card>
  );
}

function CoachCard({
  defaultText,
  messages,
  input,
  loading,
  onInputChange,
  onSend,
}: {
  defaultText: string;
  messages: { role: "user" | "ai"; text: string }[];
  input: string;
  loading: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
}) {
  const { t } = useLang();
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold text-ink">{t("mc.coach")}</span>
        <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[0.65rem] font-semibold text-brand">AI-POWERED</span>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.p key={defaultText} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[0.98rem] leading-relaxed text-ink">
          {defaultText}
        </motion.p>
      </AnimatePresence>

      {messages.length > 0 && (
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto border-t border-line pt-3">
          {messages.map((m, i) => (
            <div key={i} className={cn("text-[0.88rem]", m.role === "user" ? "text-right" : "")}>
              <span className={cn(
                "inline-block max-w-[90%] rounded-xl px-3 py-1.5",
                m.role === "user"
                  ? "bg-brand text-white"
                  : "bg-surface-muted text-ink"
              )}>
                {m.text}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-ink-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="Ask about your journey..."
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white transition-opacity disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </Card>
  );
}

function Recap({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      {icon}
      <span className="text-sm text-ink-faint">{label}</span>
      <span className="ml-auto text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function Confirmation({ plan, travellers }: { plan: Trip; travellers: import("@/types").Traveller[] }) {
  const record = plan.booking!;
  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <motion.div initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 240, damping: 16 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-confirm text-white shadow-[0_16px_40px_-12px_rgba(15,157,110,0.6)]">
          <CheckCircle2 className="h-11 w-11" strokeWidth={2.2} />
        </motion.div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Chip tone="confirm">Confirmed</Chip>
          <DemoBadge />
        </div>
        <h2 className="mt-3 text-headline">{record.recovered ? "Your backup secured the seat." : "You're booked."}</h2>
        <p className="mt-2 text-lg text-ink-soft">This is what being prepared looks like.</p>
      </div>

      <Card className="mt-7 overflow-hidden p-0">
        <div className="flex items-center justify-between bg-brand px-6 py-4 text-white">
          <div className="flex items-center gap-2"><TrainFront className="h-5 w-5" /><span className="font-semibold">{record.finalTrainName}</span></div>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">CNF</span>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-6 sm:grid-cols-4">
          <TicketField label="PNR" value={record.pnr ?? "—"} />
          <TicketField label="Coach" value={record.coach ?? "—"} />
          <TicketField label="Travellers" value={String(travellers.length)} />
          <TicketField label="Amount" value={formatFare(record.amount ?? 0)} />
        </div>
        <div className="border-t border-dashed border-line px-6 py-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Passengers</div>
          <div className="space-y-1.5">
            {travellers.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-ink-faint">{record.berths?.[i]?.berth ?? record.coach} · CNF</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-muted px-6 py-2 text-center text-[0.7rem] text-ink-faint">
          Demo confirmation · PNR, coach, seat and payment are simulated.
        </div>
      </Card>

      <p className="mt-7 text-center text-xl font-semibold tracking-tight text-ink">
        You didn&apos;t book faster.{" "}
        <span className="bg-gradient-to-r from-brand to-[#7c74f5] bg-clip-text text-transparent">You booked smarter.</span>
      </p>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Link href="/app/trips"><Button variant="secondary" size="md" className="w-full sm:w-auto"><Ticket className="h-4 w-4" /> My trips</Button></Link>
        <Link href="/app/activity"><Button variant="secondary" size="md" className="w-full sm:w-auto"><ActivityIcon className="h-4 w-4" /> Agent activity</Button></Link>
        <Link href="/app/plan"><Button size="md" className="w-full sm:w-auto"><ShieldCheck className="h-4 w-4" /> Plan another</Button></Link>
      </div>
    </div>
  );
}

function TicketField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.7rem] font-medium uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="tabular mt-0.5 text-[0.95rem] font-semibold text-ink">{value}</div>
    </div>
  );
}
