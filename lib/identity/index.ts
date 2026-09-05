import { MockIdentityProvider } from "./mock-provider";
import type { IdentityProvider } from "./types";

export * from "./types";
export { MockIdentityProvider } from "./mock-provider";

/**
 * The active identity provider. Swap this single line for an authorized
 * server-backed provider (implementing IdentityProvider) to go live — nothing
 * in the UI or store references the mock directly.
 */
export const identityProvider: IdentityProvider = new MockIdentityProvider();
