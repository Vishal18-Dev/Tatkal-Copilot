import { MockPaymentProvider, MockWalletProvider } from "./mock-provider";
import type { PaymentProvider, WalletProvider } from "./types";

export * from "./types";
export { MockWalletProvider, MockPaymentProvider } from "./mock-provider";

/** Active providers — swap for authorized, server-backed ones to go live. */
export const walletProvider: WalletProvider = new MockWalletProvider();
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
