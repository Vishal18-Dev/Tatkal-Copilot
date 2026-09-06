import { describe, it, expect } from "vitest";
import { INTERACTION_MODES, isInteractionMode } from "@/lib/interaction-mode";

describe("Interaction mode (accessibility entry point)", () => {
  it("offers exactly the three ways in", () => {
    expect(INTERACTION_MODES).toEqual(["visual", "voice", "accessible"]);
  });

  it("accepts only valid modes — guards what we persist to localStorage", () => {
    expect(isInteractionMode("visual")).toBe(true);
    expect(isInteractionMode("voice")).toBe(true);
    expect(isInteractionMode("accessible")).toBe(true);
    expect(isInteractionMode("VISUAL")).toBe(false);
    expect(isInteractionMode("")).toBe(false);
    expect(isInteractionMode(null)).toBe(false);
    expect(isInteractionMode(undefined)).toBe(false);
    expect(isInteractionMode("audio")).toBe(false);
  });
});
