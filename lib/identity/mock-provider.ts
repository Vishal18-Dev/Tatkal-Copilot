import type { IdentityConsentInput, IdentityProvider, IdentityReadiness } from "./types";

/**
 * Deterministic, demo-safe identity provider. Simulates a Consent → Verify →
 * Ready flow with a short delay; never touches a real ID. The masked reference
 * is a fixed demo value so the flow is reproducible for judging.
 */
export class MockIdentityProvider implements IdentityProvider {
  readonly id = "mock-identity";

  async beginVerification(input: IdentityConsentInput): Promise<IdentityReadiness> {
    await delay(150);
    return { status: "verifying", holderName: input.holderName, method: "aadhaar-demo" };
  }

  async confirm(input: IdentityConsentInput): Promise<IdentityReadiness> {
    // Simulated verification latency — deterministic outcome.
    await delay(900);
    return {
      status: "verified",
      holderName: input.holderName,
      maskedRef: "XXXX XXXX 2046", // DEMO placeholder — never a real Aadhaar
      method: "aadhaar-demo",
      verifiedAt: new Date().toISOString(),
    };
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
