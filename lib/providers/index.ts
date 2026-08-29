import type {
  StrategyOption,
  StrategySnapshot,
  Traveller,
  BookingMode,
  BookingRecord,
  ActivityKind,
} from "@/types";
import { trainsForCorridorPublic } from "@/lib/planner";

/* ============================================================
   Provider abstractions.

   The UI and booking logic depend only on these interfaces.
   The prototype ships Mock* implementations; authorized
   production providers (e.g. IRCTC*) can be added later
   without touching the UI.
   ============================================================ */

export interface TrainProvider {
  search(fromCity: string, toCity: string): { number: string; name: string }[];
}

export interface AvailabilityProvider {
  /** Coarse, honest confidence — never a fabricated exact probability. */
  confidence(option: StrategyOption): StrategyOption["level"];
}

export type PaymentStatus = "success" | "failed";
export interface PaymentProvider {
  charge(amountInPaise: number): Promise<{ status: PaymentStatus }>;
}

export interface BookingStep {
  kind: ActivityKind;
  text: string;
}

export interface BookingAttemptInput {
  primary: StrategyOption;
  backup: StrategyOption | null;
  travellers: Traveller[];
  mode: BookingMode;
  /** Force a particular outcome (demo/testing). Defaults to a realistic run. */
  scenario?: "recover" | "primary" | "failed" | "waitlist" | "payment_failed";
}

export interface BookingOutcome {
  record: BookingRecord;
  steps: BookingStep[];
}

export interface BookingProvider {
  attempt(input: BookingAttemptInput): Promise<BookingOutcome>;
}

/* ---------------- Mock implementations ---------------- */

const COACHES = ["A1", "B2", "B4", "A3", "B1"];
const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const mockPnr = () => String(Math.floor(2000000000 + Math.random() * 7999999999));

export const MockTrainProvider: TrainProvider = {
  search(fromCity, toCity) {
    return trainsForCorridorPublic(fromCity, toCity).map((t) => ({
      number: t.number,
      name: t.name,
    }));
  },
};

export const MockAvailabilityProvider: AvailabilityProvider = {
  confidence: (option) => option.level,
};

export const MockPaymentProvider: PaymentProvider = {
  async charge() {
    return { status: "success" };
  },
};

export const MockBookingProvider: BookingProvider = {
  async attempt({ primary, backup, travellers, scenario }) {
    const amount = primary.fare * Math.max(1, travellers.length);
    const scen =
      scenario ?? (backup ? "recover" : "primary");

    const berthsFor = (coach: string): BookingRecord["berths"] =>
      travellers.map((t, i) => ({
        travellerId: t.id,
        berth: `${coach} · ${String(12 + i * 7).padStart(2, "0")}`,
      }));

    if (scen === "failed") {
      return {
        record: {
          status: "failed",
          recovered: false,
          primaryTrainName: primary.title,
          finalTrainName: backup?.title ?? primary.title,
          reason: "Tatkal quota exhausted on both the primary and backup options.",
        },
        steps: [
          { kind: "attempt_started", text: `Attempting ${primary.title}` },
          { kind: "primary_unavailable", text: `${primary.title} — quota exhausted` },
          ...(backup
            ? [
                { kind: "backup_attempted" as ActivityKind, text: `Trying backup ${backup.title}` },
                { kind: "failed" as ActivityKind, text: `${backup.title} — quota exhausted` },
              ]
            : [{ kind: "failed" as ActivityKind, text: "No seats available" }]),
        ],
      };
    }

    if (scen === "waitlist") {
      return {
        record: {
          status: "waitlist",
          recovered: !!backup,
          primaryTrainName: primary.title,
          finalTrainName: backup?.title ?? primary.title,
          waitlistNumber: 7,
          reason: "Confirmed berths sold out; a waitlist ticket is available.",
        },
        steps: [
          { kind: "attempt_started", text: `Attempting ${primary.title}` },
          { kind: "waitlisted", text: `${primary.title} — waitlist WL 7` },
        ],
      };
    }

    if (scen === "payment_failed") {
      return {
        record: {
          status: "payment_failed",
          recovered: false,
          primaryTrainName: primary.title,
          finalTrainName: primary.title,
          amount,
          reason: "The berth was held, but the payment could not be completed.",
        },
        steps: [
          { kind: "attempt_started", text: `Attempting ${primary.title}` },
          { kind: "payment_event", text: "Berth held — payment failed" },
        ],
      };
    }

    // Success — either directly on the primary, or via backup recovery.
    if (scen === "primary" || !backup) {
      const coach = rand(COACHES);
      return {
        record: {
          status: "success",
          recovered: false,
          primaryTrainName: primary.title,
          finalTrainName: primary.title,
          pnr: mockPnr(),
          coach,
          berths: berthsFor(coach),
          amount,
        },
        steps: [
          { kind: "attempt_started", text: `Attempting ${primary.title}` },
          { kind: "payment_event", text: "Payment authorised" },
          { kind: "confirmed", text: `Confirmed on ${primary.title}` },
        ],
      };
    }

    // recover: primary fails, backup confirms.
    const coach = rand(COACHES);
    const backupAmount = backup.fare * Math.max(1, travellers.length);
    return {
      record: {
        status: "success",
        recovered: true,
        primaryTrainName: primary.title,
        finalTrainName: backup.title,
        pnr: mockPnr(),
        coach,
        berths: berthsFor(coach),
        amount: backupAmount,
      },
      steps: [
        { kind: "attempt_started", text: `Attempting ${primary.title}` },
        { kind: "primary_unavailable", text: `${primary.title} — quota exhausted` },
        { kind: "backup_attempted", text: `Switching to backup ${backup.title}` },
        { kind: "payment_event", text: "Payment authorised" },
        { kind: "confirmed", text: `Confirmed on ${backup.title}` },
      ],
    };
  },
};

/* ============================================================
   Booking Orchestrator + RailwayBookingProvider

   Agent → Booking Orchestrator → RailwayBookingProvider →
   MockRailwayBookingProvider.  In production the mock is
   replaced by an authorized railway integration (IRCTC / PSP)
   without changing the orchestrator or the UI.
   ============================================================ */

export interface RailwayBookingProvider {
  searchTrains(fromCity: string, toCity: string): { number: string; name: string }[];
  checkAvailability(option: StrategySnapshot): Promise<{ available: boolean }>;
  createBooking(option: StrategySnapshot, travellers: Traveller[]): Promise<{ holdId: string }>;
  confirmBooking(
    holdId: string,
    option: StrategySnapshot,
    travellers: Traveller[],
    recovered: boolean,
    primaryTrainName: string
  ): Promise<BookingRecord>;
  cancelBooking(holdId: string): Promise<void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const MockRailwayBookingProvider: RailwayBookingProvider = {
  searchTrains(fromCity, toCity) {
    return trainsForCorridorPublic(fromCity, toCity).map((t) => ({
      number: t.number,
      name: t.name,
    }));
  },
  async checkAvailability(option) {
    await wait(150);
    // Deterministic demo: the popular primary sells out; backups clear.
    const available = option.level === "Very High" || option.trainName.includes("Split");
    return { available };
  },
  async createBooking() {
    await wait(150);
    return { holdId: `hold_${Math.random().toString(36).slice(2, 8)}` };
  },
  async confirmBooking(_holdId, option, travellers, recovered, primaryTrainName) {
    await wait(150);
    const coach = rand(COACHES);
    return {
      status: "success",
      recovered,
      primaryTrainName,
      finalTrainName: option.trainName,
      pnr: mockPnr(),
      coach,
      berths: travellers.map((t, i) => ({
        travellerId: t.id,
        berth: `${coach} · ${String(12 + i * 7).padStart(2, "0")}`,
      })),
      amount: option.fare * Math.max(1, travellers.length),
    };
  },
  async cancelBooking() {
    await wait(50);
  },
};

export interface OrchestratorStep {
  kind: import("@/types").ActivityKind;
  text: string;
}

export const bookingOrchestrator = {
  /** Attempt the primary strategy. Returns availability + a step log. */
  async attemptPrimary(primary: StrategySnapshot) {
    const steps: OrchestratorStep[] = [
      { kind: "attempt_started", text: "Validating travellers" },
      { kind: "attempt_started", text: `Confirming selected train · ${primary.trainName}` },
      { kind: "attempt_started", text: "Checking primary strategy availability" },
    ];
    const { available } = await MockRailwayBookingProvider.checkAvailability(primary);
    steps.push(
      available
        ? { kind: "confirmed", text: `${primary.trainName} — seats available` }
        : { kind: "primary_unavailable", text: `${primary.trainName} — quota exhausted` }
    );
    return { available, steps };
  },

  /** Book the backup strategy after the primary fails. */
  async attemptBackup(
    backup: StrategySnapshot,
    travellers: Traveller[],
    primaryTrainName: string
  ) {
    const steps: OrchestratorStep[] = [
      { kind: "backup_attempted", text: `Switching to backup · ${backup.trainName}` },
      { kind: "attempt_started", text: "Preparing booking request" },
    ];
    const { holdId } = await MockRailwayBookingProvider.createBooking(backup, travellers);
    steps.push({ kind: "payment_event", text: "Payment authorised (simulated)" });
    const record = await MockRailwayBookingProvider.confirmBooking(
      holdId,
      backup,
      travellers,
      true,
      primaryTrainName
    );
    steps.push({ kind: "confirmed", text: `Confirmed on ${backup.trainName}` });
    return { record, steps };
  },

  /** Book the primary directly (used when availability is fine). */
  async bookPrimary(primary: StrategySnapshot, travellers: Traveller[]) {
    const { holdId } = await MockRailwayBookingProvider.createBooking(primary, travellers);
    const record = await MockRailwayBookingProvider.confirmBooking(
      holdId,
      primary,
      travellers,
      false,
      primary.trainName
    );
    return {
      record,
      steps: [
        { kind: "payment_event" as const, text: "Payment authorised (simulated)" },
        { kind: "confirmed" as const, text: `Confirmed on ${primary.trainName}` },
      ],
    };
  },
};

/* Active providers (swap for authorized production providers later). */
export const providers = {
  trains: MockTrainProvider,
  availability: MockAvailabilityProvider,
  booking: MockBookingProvider,
  payment: MockPaymentProvider,
  railway: MockRailwayBookingProvider,
  orchestrator: bookingOrchestrator,
  /** Surfaced in the UI as a DEMO badge. */
  isDemo: true as const,
};
