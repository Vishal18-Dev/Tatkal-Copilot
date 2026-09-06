import { describe, it, expect } from "vitest";
import { MockIdentityProvider, DEFAULT_IDENTITY } from "@/lib/identity";
import {
  MockWalletProvider,
  MockPaymentProvider,
  DEFAULT_WALLET,
} from "@/lib/payments";

describe("Identity readiness (mock provider)", () => {
  it("defaults to not_started", () => {
    expect(DEFAULT_IDENTITY.status).toBe("not_started");
  });

  it("walks Consent → Verifying → Verified", async () => {
    const p = new MockIdentityProvider();
    const begun = await p.beginVerification({ holderName: "Manoj Sharma" });
    expect(begun.status).toBe("verifying");
    expect(begun.holderName).toBe("Manoj Sharma");

    const done = await p.confirm({ holderName: "Manoj Sharma" });
    expect(done.status).toBe("verified");
    expect(done.verifiedAt).toBeTruthy();
    expect(done.maskedRef).toBeTruthy();
  });

  it("never returns anything resembling a real 12-digit Aadhaar", async () => {
    const p = new MockIdentityProvider();
    const done = await p.confirm({ holderName: "Test User" });
    // Masked ref must be masked (contains X) and hold no 12-digit run.
    expect(done.maskedRef).toMatch(/X/);
    expect(done.maskedRef ?? "").not.toMatch(/\d{12}/);
  });
});

describe("Rail Wallet (mock provider)", () => {
  it("has the demo balance default", () => {
    expect(DEFAULT_WALLET.balance).toBe(8450);
    expect(DEFAULT_WALLET.currency).toBe("INR");
  });

  it("reports coverage correctly", () => {
    const w = new MockWalletProvider(8450);
    expect(w.canCover(6380, 8450)).toBe(true);
    expect(w.canCover(9000, 8450)).toBe(false);
  });

  it("debits on success and refuses when insufficient", async () => {
    const w = new MockWalletProvider();
    const ok = await w.debit(6380, 8450);
    expect(ok.ok).toBe(true);
    expect(ok.newBalance).toBe(8450 - 6380);

    const bad = await w.debit(9000, 8450);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe("insufficient");
    expect(bad.newBalance).toBe(8450);
  });
});

describe("Primary payment rail (mock)", () => {
  it("deterministically stalls — the cue for wallet recovery", async () => {
    const bank = new MockPaymentProvider(); // default outcome
    expect(await bank.attempt(6380)).toBe("stalled");
  });

  it("can be configured to succeed or fail for other scenarios", async () => {
    expect(await new MockPaymentProvider("success").attempt(1)).toBe("success");
    expect(await new MockPaymentProvider("failed").attempt(1)).toBe("failed");
  });
});

describe("Payment-failure → Rail Wallet recovery (the signature moment)", () => {
  it("bank stalls, wallet covers the fare, and the debit leaves a positive balance", async () => {
    const bank = new MockPaymentProvider(); // stalls
    const wallet = new MockWalletProvider(DEFAULT_WALLET.balance);
    const fare = 6380; // e.g. Mumbai → Delhi, within the demo wallet balance

    // 1. Primary bank rail does not confirm.
    const rail = await bank.attempt(fare);
    expect(rail).not.toBe("success");

    // 2. The Rail Wallet can cover the held berth …
    expect(wallet.canCover(fare, DEFAULT_WALLET.balance)).toBe(true);

    // 3. … and completes the recovery, leaving a real remaining balance.
    const debit = await wallet.debit(fare, DEFAULT_WALLET.balance);
    expect(debit.ok).toBe(true);
    expect(debit.newBalance).toBe(DEFAULT_WALLET.balance - fare);
    expect(debit.newBalance).toBeGreaterThan(0);
  });

  it("declines recovery when the fare exceeds the wallet balance", async () => {
    const wallet = new MockWalletProvider(DEFAULT_WALLET.balance);
    const fare = DEFAULT_WALLET.balance + 500;

    expect(wallet.canCover(fare, DEFAULT_WALLET.balance)).toBe(false);
    const debit = await wallet.debit(fare, DEFAULT_WALLET.balance);
    expect(debit.ok).toBe(false);
    expect(debit.newBalance).toBe(DEFAULT_WALLET.balance); // untouched
  });
});
