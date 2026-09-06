import type { Trip, Traveller } from "@/types";
import type { WalletState } from "@/lib/payments/types";
import type { IdentityReadiness } from "@/lib/identity/types";
import type { Lang } from "@/lib/i18n";

/* ============================================================
   Copilot tool layer — the ONE brain shared by every interface.

   Browser voice, the calling agent, and (later) WhatsApp all read
   and act through these tools rather than reaching into the store
   or planner directly. This is what keeps "one Copilot, many
   interfaces" true: the reasoning about a journey lives here, once.

   Two hard rules encoded by this module:
     1. Tools NEVER mutate application state. Informational tools
        read a context snapshot; action tools return a *validated
        plan* describing what should happen — the existing flows
        (JourneyProvider wizard, TatkalAgent, store) execute it.
     2. Every booking/payment action carries a permission level and
        a confirmation requirement, and defers to the existing
        action-validator. Nothing here can bypass authorization.
   ============================================================ */

/**
 * Permission ladder, from least to most sensitive. Mirrors spec §11.
 *   informational — read-only; no confirmation.
 *   preparation   — edits the draft journey (train/passengers); may confirm.
 *   booking       — starts/authorizes a booking; explicit confirmation in Assisted mode.
 *   payment       — moves (simulated) money; always explicit authorization.
 */
export type PermissionLevel = "informational" | "preparation" | "booking" | "payment";

/** Static description of a tool — its contract, surfaced in tests and docs. */
export interface CopilotToolMeta {
  name: string;
  purpose: string;
  /** Names of the inputs the tool reads (from context or arguments). */
  inputs: string[];
  /** One-line description of what the tool returns. */
  output: string;
  permission: PermissionLevel;
  /** Whether invoking this tool requires an explicit user confirmation. */
  requiresConfirmation: boolean;
}

/**
 * A read-only snapshot of the current journey the tools reason over.
 * Built by the interface layer (voice/calling) from the store — the tools
 * themselves stay pure and trivially testable.
 */
export interface CopilotContext {
  lang: Lang;
  trip?: Trip;
  travellers?: Traveller[];
  wallet?: WalletState;
  identity?: IdentityReadiness;
  /** Browser or GPS geolocation coordinates */
  geolocation?: { latitude: number; longitude: number };
  /** Injectable for deterministic tests; defaults to now. */
  now?: Date;
}

/**
 * The result of an informational tool. `speak` is a short, grounded English
 * sentence; the multilingual layer translates it for display + TTS. `data`
 * is the structured payload for any UI that wants it.
 */
export interface ToolResult<T = unknown> {
  ok: boolean;
  /** Grounded, human, English one-liner. Never chain-of-thought, never a raw error. */
  speak: string;
  data?: T;
  /** Present only when ok === false — a user-safe reason, never a stack trace. */
  error?: string;
}

/**
 * The result of an action tool. Action tools do not execute — they return a
 * validated plan the interface layer runs through the EXISTING flows. When
 * `requiresConfirmation` is true the interface must get an explicit yes first.
 */
export interface ActionPlanResult {
  ok: boolean;
  /** Grounded English one-liner describing what will happen (or why it can't). */
  speak: string;
  permission: PermissionLevel;
  requiresConfirmation: boolean;
  /**
   * Where the interface should route to enact this action, if applicable.
   * Voice/calling already hand off via these — never a direct store mutation.
   */
  route?: { kind: "plan_wizard"; goal?: string } | { kind: "mission_control"; tripId: string };
  /** Present only when ok === false. */
  error?: string;
}
