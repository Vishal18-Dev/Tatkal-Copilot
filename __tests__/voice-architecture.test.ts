import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Static guard for the most important rule in the voice spec: voice is an
 * interface layer over the existing planner, never a second booking engine.
 * A confirmation must route back into /app/plan, not call booking/agent
 * code directly. This test fails loudly the moment someone wires a voice
 * command straight into TatkalAgent, the action validator, or the store's
 * booking-side methods — long before it would show up as a runtime bug.
 */

const VOICE_DIR = join(process.cwd(), "lib", "voice");

const FORBIDDEN_IMPORTS = [
  "@/lib/tatkal-agent",
  "@/lib/action-validator",
  "@/lib/providers",
  "@/lib/store", // voice must not touch trip/booking state directly
];

// The planner is explicitly allowed — voice is required to reuse it, never
// re-implement it.
const ALLOWED_GROUNDED_IMPORT = "@/lib/planner";

function voiceSourceFiles(): string[] {
  return readdirSync(VOICE_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(VOICE_DIR, f));
}

describe("Voice layer architecture boundary", () => {
  it("never imports booking/agent execution modules", () => {
    for (const file of voiceSourceFiles()) {
      const src = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(src, `${file} must not import ${forbidden}`).not.toMatch(
          new RegExp(`from\\s+["']${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`)
        );
      }
    }
  });

  it("uses the Unified Copilot Brain executeCopilotTurn rather than legacy local planner", () => {
    const respondRoute = readFileSync(
      join(process.cwd(), "app", "api", "voice", "respond", "route.ts"),
      "utf8"
    );
    expect(respondRoute).toContain("executeCopilotTurn");
    expect(respondRoute).toContain("@/lib/copilot/unified-agent");
  });

  it("keeps the Sarvam API key server-only (never imported by a client component)", () => {
    const sarvamSrc = readFileSync(join(VOICE_DIR, "sarvam.ts"), "utf8");
    expect(sarvamSrc).not.toContain('"use client"');

    // No component under components/voice may import lib/voice/sarvam directly.
    const componentsDir = join(process.cwd(), "components", "voice");
    for (const f of readdirSync(componentsDir)) {
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(join(componentsDir, f), "utf8");
      expect(src, `${f} must not import the Sarvam transport directly`).not.toMatch(
        /from\s+["']@\/lib\/voice\/sarvam["']/
      );
    }
  });

  it("routes confirmation into the existing /app/plan wizard, not a direct booking call", () => {
    const panel = readFileSync(join(process.cwd(), "components", "voice", "VoiceConversation.tsx"), "utf8");
    expect(panel).toContain("/app/plan?goal=");
    // A voice confirmation must never reference the booking orchestrator or agent.
    expect(panel).not.toMatch(/TatkalAgent|bookingOrchestrator|providers\.orchestrator/);
  });

  it("conversation.ts only ever hands the plan back via the onConfirm callback", () => {
    const src = readFileSync(join(VOICE_DIR, "conversation.ts"), "utf8");
    expect(src).toContain("onConfirm(goalRef.current, resultRef.current.plan)");
    expect(src).not.toMatch(/TatkalAgent|activateBackupStrategy|bookPrimary|attemptPrimary/);
  });
});
