/**
 * Identity Readiness — an abstraction over identity verification.
 *
 * The product idea: move the government's identity requirement out of the
 * booking-time scramble and into calm, proactive preparation ("do this before
 * Tatkal opens"). The concrete provider behind this can later be an authorized
 * Aadhaar / eKYC integration; for the demo it is a deterministic mock.
 *
 * SAFETY: no real Aadhaar number, OTP or PAN is ever collected or stored. The
 * mock works entirely from placeholder/demo values, and a real provider would
 * live server-side behind this same interface.
 */

export type IdentityStatus =
  | "not_started" // never begun
  | "consent" // consent shown, awaiting agreement
  | "verifying" // simulated check in progress
  | "verified" // ready
  | "attention"; // needs the citizen to act

export interface IdentityReadiness {
  status: IdentityStatus;
  /** Masked, demo-only reference shown after verification (never a real ID). */
  maskedRef?: string;
  /** Human name captured during the (simulated) flow. */
  holderName?: string;
  verifiedAt?: string; // ISO
  /** Abstract method label — the real provider would set its own. */
  method?: string;
}

export interface IdentityConsentInput {
  holderName: string;
}

/**
 * The swappable contract. A future authorized provider implements this
 * server-side; the demo ships a deterministic mock.
 */
export interface IdentityProvider {
  readonly id: string;
  /** Present consent + begin the (simulated) verification. */
  beginVerification(input: IdentityConsentInput): Promise<IdentityReadiness>;
  /** Complete verification — mock resolves to `verified` deterministically. */
  confirm(input: IdentityConsentInput): Promise<IdentityReadiness>;
}

export const DEFAULT_IDENTITY: IdentityReadiness = { status: "not_started" };
