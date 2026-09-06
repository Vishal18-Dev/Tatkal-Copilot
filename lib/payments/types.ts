/**
 * Payment / Wallet Readiness — an abstraction over paying for a journey.
 *
 * The product idea: payment is prepared BEFORE Tatkal, not scrambled for at
 * the window. The "Rail Wallet" is a demo stored-value balance used both to
 * show readiness ("enough balance for this journey") and as the recovery rail
 * when a simulated bank payment stalls.
 *
 * SAFETY: no real card, UPI PIN or bank credential is ever collected. All
 * amounts are demo values; a real payment/wallet provider would live
 * server-side behind these interfaces.
 */

export interface WalletState {
  /** Demo balance in whole rupees. */
  balance: number;
  currency: "INR";
  lastUpdated: string; // ISO
}

export interface DebitResult {
  ok: boolean;
  newBalance: number;
  reason?: string;
}

export interface WalletProvider {
  readonly id: string;
  getBalance(): Promise<number>;
  canCover(amount: number, current: number): boolean;
  /** Debit for a (simulated) booking; the recovery rail in the Book flow. */
  debit(amount: number, current: number): Promise<DebitResult>;
}

/** Outcome of a (simulated) primary payment rail attempt. */
export type PaymentRailOutcome = "success" | "stalled" | "failed";

export interface PaymentProvider {
  readonly id: string;
  /** Attempt the primary rail (e.g. bank). Deterministic in the demo. */
  attempt(amount: number): Promise<PaymentRailOutcome>;
}

/** Matches the golden-path demo (₹8,450 available). */
export const DEFAULT_WALLET: WalletState = {
  balance: 8450,
  currency: "INR",
  lastUpdated: "1970-01-01T00:00:00.000Z",
};
