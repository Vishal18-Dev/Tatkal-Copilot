import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Same boundary as voice-architecture.test.ts: WhatsApp is an interface
 * over the existing planner, never a second booking engine, and a "yes"
 * reply must route back into /app/plan, never call booking/agent code.
 */

const WA_DIR = join(process.cwd(), "lib", "whatsapp");
const FORBIDDEN_IMPORTS = ["@/lib/tatkal-agent", "@/lib/action-validator", "@/lib/providers", "@/lib/store"];

function waSourceFiles(): string[] {
  return readdirSync(WA_DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(WA_DIR, f));
}

describe("WhatsApp layer architecture boundary", () => {
  it("never imports booking/agent execution modules", () => {
    for (const file of waSourceFiles()) {
      const src = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(src, `${file} must not import ${forbidden}`).not.toMatch(
          new RegExp(`from\\s+["']${forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`)
        );
      }
    }
  });

  it("reuses the existing planner rather than reimplementing intent parsing", () => {
    const route = readFileSync(join(process.cwd(), "app", "api", "whatsapp", "respond", "route.ts"), "utf8");
    expect(route).toContain("parseIntentLocally");
    expect(route).toContain("buildPlanLocally");
    expect(route).toContain("@/lib/planner");
  });

  it("routes its CTA into the existing /app/plan wizard, not a direct booking call", () => {
    const thread = readFileSync(
      join(process.cwd(), "components", "whatsapp", "WhatsAppThread.tsx"),
      "utf8"
    );
    expect(thread).toContain("/app/plan?goal=");
    expect(thread).not.toMatch(/TatkalAgent|bookingOrchestrator|providers\.orchestrator/);
  });
});
