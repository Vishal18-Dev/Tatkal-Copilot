import type { DebitResult, PaymentProvider, PaymentRailOutcome, WalletProvider } from "./types";

/** Deterministic, demo-safe Rail Wallet. */
export class MockWalletProvider implements WalletProvider {
  readonly id = "mock-wallet";
  private balance: number;

  constructor(initial = 8450) {
    this.balance = initial;
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  canCover(amount: number, current: number): boolean {
    return current >= amount;
  }

  async debit(amount: number, current: number): Promise<DebitResult> {
    await delay(700);
    if (current < amount) {
      return { ok: false, newBalance: current, reason: "insufficient" };
    }
    return { ok: true, newBalance: current - amount };
  }
}

/**
 * Simulated primary payment rail (a "bank" gateway). Deterministic for the
 * demo: it STALLS, which is the cue for the wallet-recovery moment. Swap for a
 * real, authorized gateway behind this interface.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock-bank";
  private outcome: PaymentRailOutcome;

  constructor(outcome: PaymentRailOutcome = "stalled") {
    this.outcome = outcome;
  }

  async attempt(_amount: number): Promise<PaymentRailOutcome> {
    void _amount;
    await delay(1200);
    return this.outcome;
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
