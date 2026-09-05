import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Same boundary as voice/whatsapp: the calling agent is a narration layer
 * over real trip/agent state — it reads from the store but never calls
 * booking/agent execution directly, and every action it offers ("proceed",
 * "show me the backup") hands off to the real app screen instead of acting
 * on its own.
 */

const CALL_DIR = join(process.cwd(), "lib", "calling");
const FORBIDDEN_IMPORTS = ["@/lib/tatkal-agent", "@/lib/action-validator", "@/lib/providers"];

function callSourceFiles(): string[] {
  return readdirSync(CALL_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(CALL_DIR, f));
}

describe("Calling layer architecture boundary", () => {
  it("never imports booking/agent execution modules", () => {
    for (const file of callSourceFiles()) {
      const src = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(src, `${file} must not import ${forbidden}`).not.toMatch(
          new RegExp(`from\\s+["']${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`)
        );
      }
    }
  });

  it("keeps the Sarvam API key server-only (never imported by a client component)", () => {
    const componentsDir = join(process.cwd(), "components", "calling");
    for (const f of readdirSync(componentsDir)) {
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(join(componentsDir, f), "utf8");
      expect(src, `${f} must not import the Sarvam transport directly`).not.toMatch(
        /from\s+["']@\/lib\/voice\/sarvam["']/
      );
    }
  });

  it("every reply action only navigates into the real app, never books directly", () => {
    const screen = readFileSync(join(process.cwd(), "components", "calling", "CallScreen.tsx"), "utf8");
    expect(screen).toMatch(/\/app\/trips\/|\/app\/plan/);
    expect(screen).not.toMatch(/TatkalAgent|bookingOrchestrator|providers\.orchestrator|activateBackupStrategy/);
  });

  it("the script is built from real trip data, not a hardcoded narrative", () => {
    const script = readFileSync(join(CALL_DIR, "script.ts"), "utf8");
    expect(script).toContain("trip.primary.trainName");
    expect(script).toContain("trip.agentState");
  });
});
