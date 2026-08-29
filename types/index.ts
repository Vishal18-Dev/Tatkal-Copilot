/* ============================================================
   Tatkal Copilot — Core Domain Types
   ============================================================ */

export type TravelClass = "1A" | "2A" | "3A" | "SL" | "CC" | "EC";

export type Priority = "arrival-time" | "cheapest" | "comfort" | "safest";

/** Structured intent extracted from Manoj's natural-language goal. */
export interface TravelIntent {
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  /** ISO date of travel */
  date: string;
  /** e.g. "08:00" — must arrive by this local time, or null if none */
  arrivalDeadline: string | null;
  passengers: number;
  preferredClass: TravelClass | "any";
  priority: Priority;
  /** How willing Manoj is to board elsewhere / split / shift time. 0–1 */
  flexibility: number;
  /** One-line restatement of the goal in plain language. */
  restated: string;
}

export interface Station {
  code: string;
  name: string;
  city: string;
  /** Alternate boarding stations on major routes with lighter competition. */
  isAlternateBoarding?: boolean;
}

export interface ClassAvailability {
  travelClass: TravelClass;
  /** Tatkal quota seats released for this class. */
  tatkalQuota: number;
  /** Historical confirmation probability 0–100 for Tatkal in this class. */
  confirmProbability: number;
  fare: number;
}

export interface Train {
  number: string;
  name: string;
  fromCode: string;
  toCode: string;
  departure: string; // "HH:MM"
  arrival: string; // "HH:MM"
  /** +1 if arrives next day */
  arrivalDayOffset: number;
  durationMins: number;
  runsOn: string[]; // ["Mon","Tue",...] or ["Daily"]
  classes: ClassAvailability[];
  /** Tatkal window opens at this local time for this train's class group. */
  tatkalOpensAt: string; // "10:00" AC, "11:00" non-AC
  /** Relative booking demand/competition 0–100 (higher = harder). */
  competition: number;
  /** Alternate boarding stations along this train's early route. */
  alternateBoarding?: AlternateBoarding[];
}

export interface AlternateBoarding {
  stationCode: string;
  stationName: string;
  /** Minutes after origin departure that the train reaches here. */
  reachesAfterMins: number;
  /** Confirmation uplift in percentage points if boarding here. */
  confirmUplift: number;
  reason: string;
}

/** A split-journey backup: two legs that together beat a hard direct route. */
export interface SplitRoute {
  viaCode: string;
  viaName: string;
  legs: {
    trainNumber: string;
    trainName: string;
    fromCode: string;
    toCode: string;
    departure: string;
    arrival: string;
    confirmProbability: number;
  }[];
  combinedConfirmProbability: number;
  reason: string;
}

export type OptionKind = "direct" | "split";

/** Relative superlative that earns an option its coloured tag. */
export type OptionTag =
  | "recommended"
  | "highest"
  | "cheapest"
  | "fastest"
  | "popular";

/** User-facing confidence — we never show raw percentages. */
export type ConfidenceLevel = "Very High" | "High" | "Medium" | "Low";

/** One selectable Tatkal strategy the user can weigh and choose. */
export interface StrategyOption {
  id: string;
  kind: OptionKind;
  title: string; // "August Kranti Rajdhani" | "Split via Kota"
  subtitle: string; // "#12953 · 14h 05m" | "Mumbai → Kota → Delhi"
  travelClass: TravelClass;
  /** 1–5, derived from confirmation strength. */
  stars: number;
  /** Internal ranking signal — never rendered to the user directly. */
  confirmProbability: number;
  /** User-facing confidence word shown in place of a percentage. */
  level: ConfidenceLevel;
  departureDisplay: string;
  arrivalDisplay: string;
  durationDisplay: string;
  fare: number;
  boardingStationCode: string;
  boardingStationName: string;
  /** True when we recommend an alternate boarding point for a better shot. */
  betterBoarding: boolean;
  /** The single most useful label for this option. */
  tag: OptionTag;
  tagLabel: string;
  /** Whether this arrival satisfies the user's stated deadline. */
  meetsDeadline: boolean;
  why: string;
  risks: string[];
  tradeoffs: string[];
  recommended: boolean;
  tatkalOpensAt: string;
  trainNumber?: string;
  /** Present for split options. */
  legs?: {
    fromCode: string;
    toCode: string;
    trainName: string;
    departure: string;
    arrival: string;
    confirmProbability: number;
  }[];
}

export interface Plan {
  intent: TravelIntent;
  /** Recommended option first, then the rest by confirmation chance. */
  options: StrategyOption[];
  recommendedId: string;
  narrative: {
    /** Why the AI recommends the top option, agent-style. */
    whyRecommended: string;
  };
  /** Which AI path produced this plan. */
  source: "gpt" | "local";
}

export type BerthPreference =
  | "Lower"
  | "Middle"
  | "Upper"
  | "Side Lower"
  | "No preference";

export type MealPreference = "Veg" | "Non-veg" | "Jain" | "No meal";

export interface Passenger {
  id: string;
  name: string;
  age: number;
  gender: "M" | "F" | "O";
  berthPreference: BerthPreference;
  mealPreference: MealPreference;
  isSenior: boolean;
  /** Optional legacy fields — never collected in the manager form. */
  idType?: "Aadhaar" | "PAN" | "Passport";
  idMasked?: string;
}

export interface ReadinessItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  /** Some items auto-complete as the countdown progresses. */
  auto?: boolean;
}

export interface CoachMessage {
  id: string;
  /** Seconds remaining at/under which this message fires. */
  atSecondsLeft: number;
  text: string;
  tone: "info" | "action" | "warn";
}

/* ============================================================
   V2 — persistent consumer product entities
   ============================================================ */

/** A traveller is the persistent form of a Passenger. */
export type Traveller = Passenger;

export interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type ConfirmationPriority = "confirmation" | "balanced" | "price";
export type BookingMode = "assisted" | "auto";

export interface ChannelPreferences {
  inApp: boolean;
  email: boolean;
  whatsappDemo: boolean;
}

export interface UserPreferences {
  homeStationCode?: string;
  preferredClass?: TravelClass | "any";
  confirmationPriority: ConfirmationPriority;
  berthPreference?: BerthPreference;
  mealPreference?: MealPreference;
  boardingStationCodes: string[];
  defaultMode: BookingMode;
  notifications: {
    tatkalReminders: boolean;
    bookingUpdates: boolean;
    tripReminders: boolean;
  };
  channelPreferences?: ChannelPreferences;
  /** True once the user has finished (or skipped) onboarding. */
  onboarded: boolean;
}

export interface SavedJourney {
  id: string;
  fromCode: string;
  from: string;
  toCode: string;
  to: string;
  travellerIds: string[];
  travelClass: TravelClass | "any";
  priority: ConfirmationPriority;
  createdAt: string;
}

export type BookingStatus =
  | "success"
  | "failed"
  | "waitlist"
  | "payment_failed";

export interface BookingRecord {
  status: BookingStatus;
  pnr?: string;
  coach?: string;
  berths?: { travellerId: string; berth: string }[];
  amount?: number;
  waitlistNumber?: number;
  /** Whether the booking landed via the backup strategy. */
  recovered: boolean;
  primaryTrainName: string;
  finalTrainName: string;
  reason?: string;
}

export type TripStatus = "saved" | "upcoming" | "completed";

/* ---- Tatkal Agent ---- */

export type AgentState =
  | "draft"
  | "ready"
  | "scheduled"
  | "waiting"
  | "t_minus_30"
  | "t_minus_10"
  | "window_open"
  | "user_action_required"
  | "booking_in_progress"
  | "primary_failed"
  | "backup_recommended"
  | "backup_attempt"
  | "confirmed"
  | "expired"
  | "cancelled";

/** Snapshot of a strategy option stored on the plan. */
export interface StrategySnapshot {
  optionId: string;
  trainName: string;
  travelClass: TravelClass;
  boardingStationName: string;
  departureDisplay: string;
  arrivalDisplay: string;
  level: ConfidenceLevel;
  fare: number;
  via?: string;
}

export type NotificationChannel = "in-app" | "push" | "whatsapp" | "email";
export type NotificationDeliveryStatus = "sent" | "demo_generated" | "email_unavailable" | "suppressed" | "failed";

export interface PlanNotification {
  id: string;
  at: string;
  channel: NotificationChannel;
  priority?: "low" | "medium" | "high";
  title: string;
  body: string;
  deliveryStatus?: NotificationDeliveryStatus;
  recipientEmail?: string;
  notificationKey?: string;
  reason?: string;
}

/**
 * A Trip is the persistent "Tatkal Plan" — the central object the agent
 * watches over time. Booking fields fill in once the window opens.
 */
export interface Trip {
  id: string;
  status: TripStatus;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  /** Human date label for the journey. */
  dateLabel: string;
  trainName: string;
  travelClass: TravelClass;
  travellerIds: string[];
  boardingStationName: string;
  arrivalDisplay: string;
  fare: number;
  mode: BookingMode;
  booking?: BookingRecord;
  createdAt: string;

  // Agent / plan fields
  agentState: AgentState;
  agentEnabled: boolean;
  tatkalOpensAtLabel: string;
  arrivalTargetLabel?: string;
  primary: StrategySnapshot;
  backup?: StrategySnapshot | null;
  readinessDone: string[];
  planNotifications: PlanNotification[];
  channelPreferences?: ChannelPreferences;
}

export type ActivityKind =
  | "attempt_started"
  | "primary_unavailable"
  | "backup_attempted"
  | "confirmed"
  | "failed"
  | "waitlisted"
  | "payment_event"
  | "strategy_change"
  | "authorized"
  | "saved"
  | "agent_reasoning"
  | "notification_sent"
  | "readiness_check"
  | "user_inactive";

export interface ActivityEvent {
  id: string;
  tripId?: string;
  at: string; // ISO timestamp
  kind: ActivityKind;
  text: string;
  /** Optional agent metadata — tool name, action type, notification channel, etc. */
  metadata?: {
    tool?: string;
    action?: string;
    channel?: NotificationChannel;
    aiGenerated?: boolean;
    reason?: string;
    source?: "gpt" | "local";
  };
}

export interface AppNotification {
  id: string;
  at: string;
  title: string;
  body: string;
  read: boolean;
}

export interface BookingAuthorization {
  grantedAt: string;
  travellerIds: string[];
  trainId: string;
  travelClass: TravelClass;
  useBackup: boolean;
  mode: BookingMode;
}
