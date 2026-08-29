/* ============================================================
   Demo Clock — Pure Environmental Event Simulator.

   The DemoClock simulates environmental facts ONLY:
     - Time remaining to Tatkal opening (T-30, T-10, T-5, 0)
     - User activity state (active vs inactive)
     - Tatkal window status (open vs closed)
     - Primary train quota availability (available vs unavailable)

   It does NOT instruct agent actions, does NOT contain trigger
   flags (triggerBooking/triggerBackup), and does NOT directly
   mutate application agent state.
   ============================================================ */

export type EnvironmentalEventType =
  | "monitoring_started"
  | "tatkal_approaching"
  | "user_inactive"
  | "tatkal_window_open"
  | "primary_unavailable";

export interface DemoEnvironmentBeat {
  /** The environmental event name. */
  event: EnvironmentalEventType;
  /** Seconds remaining until Tatkal opens (0 when window open). */
  secondsRemaining: number;
  /** Human-readable display label for countdown clock UI. */
  countdownLabel: string;
  /** Description of what is happening in the environment. */
  description: string;
  /** Is the Tatkal window open in the environment? */
  windowOpen: boolean;
  /** Is the passenger active in the app? */
  userActive: boolean;
  /** Is the primary train Tatkal quota available? */
  primaryAvailable: boolean;
}

export const DEMO_ENVIRONMENT_TIMELINE: DemoEnvironmentBeat[] = [
  {
    event: "monitoring_started",
    secondsRemaining: 1800,
    countdownLabel: "10:00 AM",
    description: "Monitoring started · All systems initialized",
    windowOpen: false,
    userActive: true,
    primaryAvailable: true,
  },
  {
    event: "tatkal_approaching",
    secondsRemaining: 30,
    countdownLabel: "30:00",
    description: "Tatkal opens in 30 minutes · Passenger list verified",
    windowOpen: false,
    userActive: true,
    primaryAvailable: true,
  },
  {
    event: "tatkal_approaching",
    secondsRemaining: 10,
    countdownLabel: "10:00",
    description: "Tatkal opens in 10 minutes · Payment vault standby",
    windowOpen: false,
    userActive: true,
    primaryAvailable: true,
  },
  {
    event: "user_inactive",
    secondsRemaining: 5,
    countdownLabel: "05:00",
    description: "Passenger inactive · 5 minutes to Tatkal window",
    windowOpen: false,
    userActive: false,
    primaryAvailable: true,
  },
  {
    event: "tatkal_window_open",
    secondsRemaining: 0,
    countdownLabel: "00:00",
    description: "Tatkal window is now OPEN",
    windowOpen: true,
    userActive: true,
    primaryAvailable: true,
  },
  {
    event: "primary_unavailable",
    secondsRemaining: 0,
    countdownLabel: "LIVE",
    description: "IRCTC report: Primary train Tatkal quota EXHAUSTED",
    windowOpen: true,
    userActive: true,
    primaryAvailable: false,
  },
];

export type DemoClockStatus = "idle" | "running" | "paused" | "complete";

export interface DemoClockCallbacks {
  onBeat: (beat: DemoEnvironmentBeat, index: number) => void | Promise<void>;
  onComplete: () => void;
  onStatusChange: (status: DemoClockStatus) => void;
}

export class DemoClock {
  private beatIndex = 0;
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private status: DemoClockStatus = "idle";
  private callbacks: DemoClockCallbacks;
  /** Milliseconds between beats. Default 2500ms for comfortable pacing. */
  private beatInterval: number;

  constructor(callbacks: DemoClockCallbacks, beatIntervalMs = 2500) {
    this.callbacks = callbacks;
    this.beatInterval = beatIntervalMs;
  }

  get currentBeat(): DemoEnvironmentBeat | null {
    return DEMO_ENVIRONMENT_TIMELINE[this.beatIndex] ?? null;
  }

  get currentIndex(): number {
    return this.beatIndex;
  }

  get totalBeats(): number {
    return DEMO_ENVIRONMENT_TIMELINE.length;
  }

  get currentStatus(): DemoClockStatus {
    return this.status;
  }

  start(): void {
    if (this.status === "running") return;
    this.setStatus("running");
    this.scheduleTick();
  }

  pause(): void {
    if (this.status !== "running") return;
    this.clearTimer();
    this.setStatus("paused");
  }

  reset(): void {
    this.clearTimer();
    this.beatIndex = 0;
    this.setStatus("idle");
  }

  /** Advance to the next beat immediately. */
  async step(): Promise<void> {
    if (this.beatIndex >= DEMO_ENVIRONMENT_TIMELINE.length) return;
    const beat = DEMO_ENVIRONMENT_TIMELINE[this.beatIndex];
    await this.callbacks.onBeat(beat, this.beatIndex);
    this.beatIndex++;
    if (this.beatIndex >= DEMO_ENVIRONMENT_TIMELINE.length) {
      this.clearTimer();
      this.setStatus("complete");
      this.callbacks.onComplete();
    }
  }

  destroy(): void {
    this.clearTimer();
  }

  // ────── Private ──────

  private scheduleTick(): void {
    this.intervalId = setTimeout(async () => {
      if (this.status !== "running") return;
      await this.step();
      if (this.status === "running") {
        this.scheduleTick();
      }
    }, this.beatInterval);
  }

  private clearTimer(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  private setStatus(s: DemoClockStatus): void {
    this.status = s;
    this.callbacks.onStatusChange(s);
  }
}
