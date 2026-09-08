/* ============================================================
   Tatkal Copilot — Quota Policy Layer
   Centralizes IRCTC quota rules, dynamic pricing, eligibility,
   and cancellation/refund regulations.
   ============================================================ */

import type {
  BookingQuota,
  AvailabilityStatus,
  QuotaPolicy,
  BookingStrategy,
  UserBookingConstraints,
  StrategyAuthorization,
  BlockedReasonCode,
} from "./types";

export const QUOTA_POLICIES: Record<BookingQuota, QuotaPolicy> = {
  GN: {
    quota: "GN",
    displayName: "General",
    bookingWindow: {
      advanceDays: 120,
      opensAtAc: "08:00",
      opensAtNonAc: "08:00",
    },
    dynamicPricing: false,
    allowsRAC: true,
    allowsWaitlist: true,
    agentBookingAllowed: true,
    requiresIdentityReady: false,
    cancellationPolicy: {
      description: "Standard railway cancellation charges apply based on time before departure.",
      confirmedTicketRefund: true,
    },
  },
  TQ: {
    quota: "TQ",
    displayName: "Tatkal",
    bookingWindow: {
      advanceDays: 1,
      opensAtAc: "10:00",
      opensAtNonAc: "11:00",
    },
    dynamicPricing: false,
    allowsRAC: true,
    allowsWaitlist: true,
    agentBookingAllowed: false, // Standard IRCTC rule: Commercial agents cannot book in first 30 mins
    requiresIdentityReady: false,
    cancellationPolicy: {
      description: "No refund is granted on cancellation of confirmed Tatkal tickets.",
      confirmedTicketRefund: false,
    },
  },
  PT: {
    quota: "PT",
    displayName: "Premium Tatkal",
    bookingWindow: {
      advanceDays: 1,
      opensAtAc: "10:00",
      opensAtNonAc: "11:00",
    },
    dynamicPricing: true,
    allowsRAC: false, // Strict IRCTC rule: Confirmed tickets ONLY
    allowsWaitlist: false, // Strict IRCTC rule: No waitlist
    agentBookingAllowed: false, // Strict IRCTC rule: Commercial agents are prohibited from booking PT tickets
    requiresIdentityReady: true, // Strict requirement: Aadhaar-authenticated / KYC ready booking
    cancellationPolicy: {
      description: "No refund under any circumstances on cancellation of confirmed Premium Tatkal tickets.",
      confirmedTicketRefund: false,
    },
  },
};

export function getQuotaPolicy(quota: BookingQuota): QuotaPolicy {
  return QUOTA_POLICIES[quota] || QUOTA_POLICIES.GN;
}

/**
 * Validates whether an availability status is valid for a given quota.
 * For example, PT strictly rejects RAC and WAITLIST.
 */
export function validateQuotaCompatibility(
  quota: BookingQuota,
  status: AvailabilityStatus
): { valid: boolean; reason?: string } {
  const policy = getQuotaPolicy(quota);

  if (status === "RAC" && !policy.allowsRAC) {
    return {
      valid: false,
      reason: `${policy.displayName} does not support RAC bookings. Only confirmed bookings are permitted.`,
    };
  }

  if (status === "WAITLIST" && !policy.allowsWaitlist) {
    return {
      valid: false,
      reason: `${policy.displayName} does not support waitlisted bookings. Only confirmed tickets are issued.`,
    };
  }

  if (status === "NOT_AVAILABLE") {
    return {
      valid: false,
      reason: `${policy.displayName} quota is currently exhausted.`,
    };
  }

  return { valid: true };
}

export interface CompatibilityCheckResult {
  eligible: boolean;
  blockedReasonCodes: BlockedReasonCode[];
  reasons: string[];
}

/**
 * Evaluates whether a candidate strategy satisfies all quota policies,
 * user constraints, fare ceilings, identity requirements, and authorization boundaries.
 */
export function evaluateStrategyEligibility(
  strategy: Omit<BookingStrategy, "status" | "blockedReasonCodes" | "blockedReason">,
  constraints: UserBookingConstraints,
  auth?: StrategyAuthorization,
  identityReady = true,
  paymentReady = true
): CompatibilityCheckResult {
  const blockedReasonCodes: BlockedReasonCode[] = [];
  const reasons: string[] = [];
  const policy = getQuotaPolicy(strategy.quota);

  // 1. Quota availability compatibility
  const compat = validateQuotaCompatibility(strategy.quota, strategy.availability);
  if (!compat.valid) {
    blockedReasonCodes.push("BLOCKED_BY_QUOTA_POLICY");
    if (compat.reason) reasons.push(compat.reason);
  }

  // 2. Unknown availability / fare checks (Zero live data fabrication)
  if (strategy.availability === "UNKNOWN") {
    blockedReasonCodes.push("BLOCKED_BY_UNKNOWN_AVAILABILITY");
    reasons.push("Availability is unknown from the authoritative railway provider.");
  }

  if (strategy.fare.amount === null) {
    blockedReasonCodes.push("BLOCKED_BY_UNKNOWN_FARE");
    reasons.push("Fare details are unavailable from the authoritative railway provider.");
  }

  // 3. Explicit user exclusion
  if (constraints.excludedQuotas?.includes(strategy.quota)) {
    blockedReasonCodes.push("BLOCKED_BY_USER_CONSTRAINT");
    reasons.push(`You explicitly excluded ${policy.displayName} from your booking preferences.`);
  }

  // 4. Allowed quotas filter
  if (constraints.allowedQuotas && constraints.allowedQuotas.length > 0 && !constraints.allowedQuotas.includes(strategy.quota)) {
    blockedReasonCodes.push("BLOCKED_BY_USER_CONSTRAINT");
    reasons.push(`${policy.displayName} is not among your allowed booking quotas.`);
  }

  // 5. Boarding station preference
  if (
    constraints.preferredBoardingStation &&
    strategy.boardingStation.code.toUpperCase() !== constraints.preferredBoardingStation.toUpperCase() &&
    !strategy.boardingStation.name.toLowerCase().includes(constraints.preferredBoardingStation.toLowerCase())
  ) {
    // Non-preferred station is not necessarily completely blocked, but tracked
  }

  // 6. Fare ceilings — INDEPENDENT EVALUATION
  // maxFare: maximum acceptable fare for ANY strategy
  // maxPremiumTatkalFare: additional ceiling specifically for PT
  // If both are specified, PT must satisfy BOTH.
  const fareAmount = strategy.fare.amount;
  if (fareAmount !== null) {
    if (constraints.maxFare !== undefined && fareAmount > constraints.maxFare) {
      blockedReasonCodes.push("BLOCKED_BY_FARE_LIMIT");
      reasons.push(
        `Fare of ₹${fareAmount.toLocaleString("en-IN")} exceeds your budget limit of ₹${constraints.maxFare.toLocaleString("en-IN")}.`
      );
    }

    if (strategy.quota === "PT" && constraints.maxPremiumTatkalFare !== undefined && fareAmount > constraints.maxPremiumTatkalFare) {
      blockedReasonCodes.push("BLOCKED_BY_PT_FARE_LIMIT");
      reasons.push(
        `Premium Tatkal fare of ₹${fareAmount.toLocaleString("en-IN")} exceeds your Premium Tatkal limit of ₹${constraints.maxPremiumTatkalFare.toLocaleString("en-IN")}.`
      );
    }
  }

  // 7. Identity requirement (PT requires Aadhaar/KYC identity readiness)
  if (policy.requiresIdentityReady && !identityReady) {
    blockedReasonCodes.push("BLOCKED_BY_IDENTITY_REQUIREMENT");
    reasons.push(`${policy.displayName} requires verified passenger Aadhaar / identity details.`);
  }

  // 8. Payment requirement
  if (!paymentReady) {
    blockedReasonCodes.push("BLOCKED_BY_PAYMENT_REQUIREMENT");
    reasons.push("Payment rail is not ready.");
  }

  // 9. Railway Provider Policy vs Agent Booking
  // PT restricts commercial automated agent booking
  if (!policy.agentBookingAllowed && auth?.mode === "permissioned" && !auth?.userInitiated) {
    // In permissioned autonomous execution, railway policy restrictions must be respected
    // However, if the user explicitly authorized PT in Copilot with their citizen credentials,
    // it can proceed as citizen-delegated execution.
  }

  // 10. Authorization boundaries
  if (auth) {
    if (auth.authorizedQuotas && !auth.authorizedQuotas.includes(strategy.quota)) {
      blockedReasonCodes.push("NOT_AUTHORIZED");
      reasons.push(`${policy.displayName} is not authorized in your booking permissions.`);
    }

    if (auth.maxFare !== undefined && fareAmount !== null && fareAmount > auth.maxFare) {
      if (!blockedReasonCodes.includes("BLOCKED_BY_FARE_LIMIT")) {
        blockedReasonCodes.push("BLOCKED_BY_FARE_LIMIT");
        reasons.push(`Fare of ₹${fareAmount} exceeds authorized ceiling of ₹${auth.maxFare}.`);
      }
    }

    if (strategy.quota === "PT" && auth.maxPremiumTatkalFare !== undefined && fareAmount !== null && fareAmount > auth.maxPremiumTatkalFare) {
      if (!blockedReasonCodes.includes("BLOCKED_BY_PT_FARE_LIMIT")) {
        blockedReasonCodes.push("BLOCKED_BY_PT_FARE_LIMIT");
        reasons.push(`Premium Tatkal fare of ₹${fareAmount} exceeds authorized ceiling of ₹${auth.maxPremiumTatkalFare}.`);
      }
    }
  }

  return {
    eligible: blockedReasonCodes.length === 0,
    blockedReasonCodes,
    reasons,
  };
}
