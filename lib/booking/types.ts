/* ============================================================
   Tatkal Copilot — Booking Domain Types
   Canonical Quota, Fare, Policy, and Strategy Representations
   ============================================================ */

export type BookingQuota = "GN" | "TQ" | "PT";

export type AvailabilityStatus =
  | "CONFIRMED"
  | "RAC"
  | "WAITLIST"
  | "NOT_AVAILABLE"
  | "UNKNOWN";

export interface FareInfo {
  amount: number | null;
  currency: "INR";
  quota: BookingQuota;
  isDynamic: boolean;
  baseFare?: number | null;
  dynamicComponent?: number | null;
  isEstimated: boolean;
  fareSource: "live_railradar" | "irctc_provider" | "demo_state_machine" | "unavailable";
}

export interface QuotaPolicy {
  quota: BookingQuota;
  displayName: string;
  bookingWindow: {
    advanceDays: number;
    opensAtAc: string;
    opensAtNonAc: string;
  };
  dynamicPricing: boolean;
  allowsRAC: boolean;
  allowsWaitlist: boolean;
  /** Railway/provider regulation constraint (IRCTC policy: PT prohibits commercial agent automated booking) */
  agentBookingAllowed: boolean;
  /** Aadhaar-authenticated / KYC ready booking requirement */
  requiresIdentityReady: boolean;
  cancellationPolicy: {
    description: string;
    confirmedTicketRefund: boolean;
  };
}

export type StrategyStatus = "eligible" | "blocked" | "unavailable";

export type BlockedReasonCode =
  | "BLOCKED_BY_FARE_LIMIT"
  | "BLOCKED_BY_PT_FARE_LIMIT"
  | "BLOCKED_BY_USER_CONSTRAINT"
  | "BLOCKED_BY_QUOTA_POLICY"
  | "BLOCKED_BY_IDENTITY_REQUIREMENT"
  | "BLOCKED_BY_PAYMENT_REQUIREMENT"
  | "BLOCKED_BY_PROVIDER_POLICY"
  | "BLOCKED_BY_UNKNOWN_AVAILABILITY"
  | "BLOCKED_BY_UNKNOWN_FARE"
  | "NOT_AUTHORIZED";

export interface StrategyStation {
  code: string;
  name: string;
}

export interface StrategyProvenance {
  availabilitySource: string;
  fareSource: string;
  policySource: string;
  isDemoData?: boolean;
}

export interface BookingStrategy {
  id: string;
  journeyId: string;
  trainNumber: string;
  trainName: string;
  quota: BookingQuota;
  travelClass: string;
  boardingStation: StrategyStation;
  arrivalStation: StrategyStation;
  departure: string;
  arrival: string;
  durationMins: number;
  fare: FareInfo;
  availability: AvailabilityStatus;
  tatkalSuitability: "high" | "moderate" | "low" | "unsuitable";
  rationale: string[];
  priorityScore: number;
  status: StrategyStatus;
  blockedReasonCodes?: BlockedReasonCode[];
  blockedReason?: string;
  authorizationRequired: boolean;
  provenance: StrategyProvenance;
}

export interface StrategyAuthorization {
  mode: "assisted" | "permissioned";
  userInitiated?: boolean;
  authorizedQuotas: BookingQuota[];
  maxFare?: number;
  maxPremiumTatkalFare?: number;
  allowedClasses?: string[];
  allowedStations?: string[];
  allowAutomaticFallback: boolean;
  requireConfirmationForPremiumTatkal: boolean;
}

export interface UserBookingConstraints {
  maxFare?: number;
  maxPremiumTatkalFare?: number;
  preferredClass?: string;
  preferredBoardingStation?: string;
  confirmationPriority?: "low" | "medium" | "high";
  priceSensitivity?: "low" | "medium" | "high";
  arrivalPriority?: "low" | "medium" | "high";
  allowedQuotas?: BookingQuota[];
  excludedQuotas?: BookingQuota[];
  allowAutomaticFallback?: boolean;
}

export interface StrategyEvaluationResult {
  primary: BookingStrategy | null;
  backup: BookingStrategy | null;
  candidates: BookingStrategy[];
  fallbackOrder: BookingStrategy[];
  explanation: string;
  activeConstraints: UserBookingConstraints;
}
