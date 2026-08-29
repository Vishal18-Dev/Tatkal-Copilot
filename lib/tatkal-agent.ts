import type {
  Trip,
  AgentState,
  ActivityKind,
  NotificationChannel,
  NotificationDeliveryStatus,
  StrategySnapshot,
  Traveller,
  ChannelPreferences,
} from "@/types";
import { readinessFor } from "@/lib/agent";
import {
  validateAgentDecision,
  type ProposedAgentDecision,
  type ValidationResult,
  type AllowedAgentAction,
  type AllowedAgentTool,
} from "@/lib/action-validator";
import type { DemoEnvironmentBeat } from "@/lib/demo-clock";

/* ============================================================
   TatkalAgent — Genuine Agentic Runtime (v1.6)

   Control Flow:
     DemoClock/Env Event
        ↓
     observe(envBeat)
        ↓
     evaluate() → calls /api/agent-reason (Observation ONLY)
        ↓
     Structured AgentDecision { action, reason, toolCall, source }
        ↓
     validateAgentDecision()
        ↓
     act() → Tool Execution → State Mutation → Activity Log
   ============================================================ */

export interface ToolInvocation {
  tool: string;
  args?: Record<string, unknown>;
  result: unknown;
  timestamp: string;
}

export interface AgentObservation {
  journeyState: AgentState;
  envEvent?: string;
  secondsRemaining?: number;
  userActive?: boolean;
  primaryAvailable?: boolean;
  readinessDone: number;
  readinessTotal: number;
  selectedTrain: StrategySnapshot | null;
  backupStrategy: StrategySnapshot | null;
  currentTime: string;
  tatkalOpensLabel: string;
  windowOpen: boolean;
  bookingStatus: string;
  notificationsSent: string[];
  channelPreferences?: ChannelPreferences;
}

export interface AgentEventRecord {
  kind: ActivityKind;
  text: string;
  metadata?: {
    tool?: string;
    action?: string;
    channel?: NotificationChannel;
    aiGenerated?: boolean;
    reason?: string;
    source?: "gpt" | "local";
  };
}

export interface AgentCallbacks {
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  logActivity: (events: Omit<import("@/types").ActivityEvent, "id" | "at">[], tripId?: string) => void;
  pushNotification: (n: { title: string; body: string }) => void;
  getTravellers: () => Traveller[];
  onExecutePrimaryBooking?: () => Promise<void>;
  onExecuteBackupBooking?: () => Promise<void>;
}

export class TatkalAgent {
  private trip: Trip;
  private callbacks: AgentCallbacks;
  private sentNotificationKeys = new Set<string>();
  private toolLog: ToolInvocation[] = [];
  private currentEnvBeat: DemoEnvironmentBeat | null = null;

  constructor(trip: Trip, callbacks: AgentCallbacks) {
    this.trip = trip;
    this.callbacks = callbacks;
    for (const n of trip.planNotifications) {
      if (n.notificationKey) this.sentNotificationKeys.add(`key:${n.notificationKey}`);
      this.sentNotificationKeys.add(`${n.channel}:${n.title}`);
      this.sentNotificationKeys.add(`title:${n.title}`);
    }
  }

  updateTrip(trip: Trip) {
    this.trip = trip;
  }

  // ════════════════════════════════════════════
  //  TOOLS — Each tool handles actual state mutation
  // ════════════════════════════════════════════

  async notifyUser(
    channel: NotificationChannel,
    title: string,
    body: string,
    options?: {
      priority?: "low" | "medium" | "high";
      notificationKey?: string;
      reason?: string;
      recipientEmail?: string;
    }
  ): Promise<boolean> {
    const notifKey = options?.notificationKey;
    const dedupeKey = notifKey ? `key:${notifKey}` : `${channel}:${title}`;
    
    if (this.sentNotificationKeys.has(dedupeKey) || this.sentNotificationKeys.has(`title:${title}`)) {
      this.recordEvent({
        kind: "notification_sent",
        text: `Notification suppressed — identical notification (${title}) already sent`,
        metadata: { tool: "notifyUser", channel, action: "notify_user", reason: "suppressed" },
      });
      this.logTool("notifyUser", { channel, title, deduplicated: true }, false);
      return false;
    }

    this.sentNotificationKeys.add(dedupeKey);
    if (notifKey) this.sentNotificationKeys.add(`key:${notifKey}`);
    this.sentNotificationKeys.add(`${channel}:${title}`);
    this.sentNotificationKeys.add(`title:${title}`);

    let deliveryStatus: NotificationDeliveryStatus = "sent";
    let recipient = options?.recipientEmail || "passenger@example.com";

    try {
      if (typeof window !== "undefined" && typeof fetch !== "undefined") {
        const res = await fetch("/api/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId: this.trip.id,
            channel,
            priority: options?.priority || "high",
            title,
            body,
            reason: options?.reason,
            recipientEmail: recipient,
            notificationKey: notifKey,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          deliveryStatus = data.deliveryStatus || "sent";
          if (data.recipientEmail) recipient = data.recipientEmail;
        }
      } else {
        const { sendNotification } = await import("@/lib/notifications");
        const res = await sendNotification({
          tripId: this.trip.id,
          channel,
          priority: options?.priority || "high",
          title,
          body,
          reason: options?.reason,
          recipientEmail: recipient,
          notificationKey: notifKey,
        });
        deliveryStatus = res.deliveryStatus;
        if (res.recipientEmail) recipient = res.recipientEmail;
      }
    } catch {
      deliveryStatus = channel === "email" ? "demo_generated" : "sent";
    }

    this.callbacks.pushNotification({ title, body });

    const notif: import("@/types").PlanNotification = {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      at: new Date().toISOString(),
      channel,
      priority: options?.priority || "high",
      title,
      body,
      deliveryStatus,
      recipientEmail: recipient,
      notificationKey: notifKey,
      reason: options?.reason,
    };

    this.callbacks.updateTrip(this.trip.id, {
      planNotifications: [...this.trip.planNotifications, notif],
      agentState: "user_action_required",
    });

    const statusLabel =
      deliveryStatus === "demo_generated"
        ? "Demo email generated"
        : deliveryStatus === "email_unavailable"
        ? "Email unavailable (in-app fallback)"
        : "Sent";

    this.recordEvent({
      kind: "notification_sent",
      text: `${channel.toUpperCase()} notification (${statusLabel}): ${title}`,
      metadata: {
        tool: "notifyUser",
        channel,
        action: "notify_user",
        reason: options?.reason || "User escalation",
        source: "gpt",
      },
    });

    this.logTool("notifyUser", { channel, title, deliveryStatus }, true);
    return true;
  }

  async openBookingFlow(): Promise<void> {
    this.callbacks.updateTrip(this.trip.id, { agentState: "booking_in_progress" });
    this.recordEvent({
      kind: "attempt_started",
      text: "Agent initiated primary booking flow",
      metadata: { tool: "openBookingFlow", action: "open_booking_flow" },
    });
    this.logTool("openBookingFlow", undefined, "started");

    if (this.callbacks.onExecutePrimaryBooking) {
      await this.callbacks.onExecutePrimaryBooking();
    }
  }

  async activateBackupStrategy(): Promise<void> {
    if (!this.trip.backup) return;
    this.callbacks.updateTrip(this.trip.id, { agentState: "backup_attempt" });
    this.recordEvent({
      kind: "backup_attempted",
      text: `Agent activated backup strategy: ${this.trip.backup.trainName}`,
      metadata: { tool: "activateBackupStrategy", action: "activate_backup" },
    });
    this.logTool("activateBackupStrategy", undefined, this.trip.backup.trainName);

    if (this.callbacks.onExecuteBackupBooking) {
      await this.callbacks.onExecuteBackupBooking();
    }
  }

  recordEvent(event: AgentEventRecord): void {
    this.callbacks.logActivity(
      [{ kind: event.kind, text: event.text, metadata: event.metadata }],
      this.trip.id
    );
  }

  // ════════════════════════════════════════════
  //  AGENT LIFECYCLE: observe → evaluate → act
  // ════════════════════════════════════════════

  /** Gather environmental + application context. */
  observe(envBeat?: DemoEnvironmentBeat): AgentObservation {
    if (envBeat) this.currentEnvBeat = envBeat;
    const readiness = readinessFor(this.trip);
    return {
      journeyState: this.trip.agentState,
      envEvent: this.currentEnvBeat?.event ?? "nominal",
      secondsRemaining: this.currentEnvBeat?.secondsRemaining ?? 0,
      userActive: this.currentEnvBeat?.userActive ?? true,
      primaryAvailable: this.currentEnvBeat?.primaryAvailable ?? true,
      readinessDone: readiness.filter((r) => r.done).length,
      readinessTotal: readiness.length,
      selectedTrain: this.trip.primary,
      backupStrategy: this.trip.backup ?? null,
      currentTime: new Date().toISOString(),
      tatkalOpensLabel: this.trip.tatkalOpensAtLabel,
      windowOpen: this.currentEnvBeat?.windowOpen ?? (this.trip.agentState === "window_open" || this.trip.agentState === "booking_in_progress"),
      bookingStatus: this.trip.booking?.status ?? "none",
      notificationsSent: Array.from(this.sentNotificationKeys),
      channelPreferences: this.trip.channelPreferences || { inApp: true, email: true, whatsappDemo: false },
    };
  }

  /** Send observation to OpenAI (/api/agent-reason) to DECIDE the action. */
  async evaluate(obs: AgentObservation): Promise<ProposedAgentDecision> {
    try {
      const res = await fetch("/api/agent-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observation: {
            journeyState: obs.journeyState,
            envEvent: obs.envEvent,
            secondsRemaining: obs.secondsRemaining,
            userActive: obs.userActive,
            primaryAvailable: obs.primaryAvailable,
            from: this.trip.from,
            to: this.trip.to,
            primaryTrain: obs.selectedTrain?.trainName ?? "",
            backupTrain: obs.backupStrategy?.trainName ?? null,
            readinessDone: obs.readinessDone,
            readinessTotal: obs.readinessTotal,
            tatkalOpensLabel: obs.tatkalOpensLabel,
            windowOpen: obs.windowOpen,
            bookingStatus: obs.bookingStatus,
            notificationsSent: obs.notificationsSent,
            channelPreferences: obs.channelPreferences,
          },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        action: data.action as AllowedAgentAction,
        reason: data.reason || "Observation evaluated.",
        toolCall: data.toolCall,
        source: (data.source as "gpt" | "local") || "local",
      };
    } catch (err) {
      console.warn("[TatkalAgent] Agent reasoning call failed, using local decision logic:", err);
      return this.evaluateLocally(obs);
    }
  }

  /** Execute & validate decision. Returns validation outcome. */
  async act(decision: ProposedAgentDecision): Promise<{ validation: ValidationResult; executedTool?: string }> {
    // 1. Validate decision
    const validation = validateAgentDecision(decision, this.trip, this.sentNotificationKeys);

    if (!validation.valid) {
      this.recordEvent({
        kind: "agent_reasoning",
        text: `Action rejected: ${validation.reason}`,
        metadata: {
          action: decision.action,
          reason: validation.reason,
          source: decision.source,
        },
      });
      return { validation };
    }

    // 2. Log proposed reasoning
    this.recordEvent({
      kind: "agent_reasoning",
      text: decision.reason,
      metadata: {
        action: decision.action,
        tool: decision.toolCall?.name,
        aiGenerated: decision.source === "gpt",
        source: decision.source,
      },
    });

    // 3. Execute matching tool call
    let executedTool: string | undefined = undefined;

    switch (decision.action) {
      case "notify_user": {
        const prefEmail = this.trip.channelPreferences?.email ?? true;
        const channel = (decision.toolCall?.arguments?.channel as NotificationChannel) || (prefEmail ? "email" : "in-app");
        const title = (decision.toolCall?.arguments?.title as string) || "Tatkal Window Alert";
        const msg = (decision.toolCall?.arguments?.message as string) ||
          (decision.toolCall?.arguments?.body as string) ||
          `Tatkal window opens soon for ${this.trip.from} → ${this.trip.to}.`;
        const priority = (decision.toolCall?.arguments?.priority as "low" | "medium" | "high") || "high";
        const notificationKey = (decision.toolCall?.arguments?.notificationKey as string) || undefined;

        await this.notifyUser(channel, title, msg, {
          priority,
          notificationKey,
          reason: decision.reason,
        });
        executedTool = "notifyUser";
        break;
      }

      case "open_booking_flow": {
        await this.openBookingFlow();
        executedTool = "openBookingFlow";
        break;
      }

      case "activate_backup": {
        await this.activateBackupStrategy();
        executedTool = "activateBackupStrategy";
        break;
      }

      case "evaluate_backup": {
        this.callbacks.updateTrip(this.trip.id, { agentState: "backup_recommended" });
        this.recordEvent({
          kind: "strategy_change",
          text: `Agent evaluating backup option: ${this.trip.backup?.trainName ?? "none"}`,
          metadata: { action: "evaluate_backup" },
        });
        executedTool = "evaluate_backup";
        break;
      }

      case "none":
      default:
        break;
    }

    return { validation, executedTool };
  }

  /** Run complete tick: observe → evaluate (OpenAI) → act (validate & execute). */
  async tick(envBeat?: DemoEnvironmentBeat): Promise<{
    observation: AgentObservation;
    decision: ProposedAgentDecision;
    validation: ValidationResult;
    executedTool?: string;
  }> {
    const observation = this.observe(envBeat);
    const decision = await this.evaluate(observation);
    const { validation, executedTool } = await this.act(decision);
    return { observation, decision, validation, executedTool };
  }

  getContextForAI(): Record<string, unknown> {
    return {
      tripId: this.trip.id,
      from: this.trip.from,
      to: this.trip.to,
      agentState: this.trip.agentState,
      primaryTrain: this.trip.primary.trainName,
      backupTrain: this.trip.backup?.trainName ?? null,
      tatkalOpens: this.trip.tatkalOpensAtLabel,
      bookingState: this.trip.booking ?? null,
      notificationsSent: Array.from(this.sentNotificationKeys),
      channelPreferences: this.trip.channelPreferences,
    };
  }

  getToolLog(): ToolInvocation[] {
    return [...this.toolLog];
  }

  // ────── Private local evaluation baseline ──────

  private evaluateLocally(obs: AgentObservation): ProposedAgentDecision {
    if (obs.primaryAvailable === false && obs.backupStrategy) {
      return {
        action: "activate_backup",
        reason: "Primary strategy unavailable (quota exhausted). Fallback rule engine activated backup.",
        toolCall: { name: "activateBackupStrategy", arguments: {} },
        source: "local",
      };
    }
    if (obs.userActive === false && (obs.secondsRemaining ?? 999) <= 30) {
      const channel = obs.channelPreferences?.email ? "email" : "in-app";
      return {
        action: "notify_user",
        reason: "Passenger inactive shortly before Tatkal window. Dispatching email/app alert.",
        toolCall: {
          name: "notifyUser",
          arguments: {
            channel,
            priority: "high",
            title: "Tatkal Window Opening Soon",
            message: `Your Tatkal window opens in ${obs.secondsRemaining ?? 5} minutes for ${this.trip.from} → ${this.trip.to}.`,
            notificationKey: "tatkal_warning_10m",
          },
        },
        source: "local",
      };
    }
    if (obs.windowOpen && obs.primaryAvailable !== false && obs.bookingStatus === "none") {
      return {
        action: "open_booking_flow",
        reason: "Tatkal window is open. Initiating primary booking.",
        toolCall: { name: "openBookingFlow", arguments: {} },
        source: "local",
      };
    }
    return {
      action: "none",
      reason: "Monitoring environment. Systems nominal.",
      source: "local",
    };
  }

  private logTool(tool: string, args: Record<string, unknown> | undefined, result: unknown) {
    this.toolLog.push({ tool, args, result, timestamp: new Date().toISOString() });
  }
}
