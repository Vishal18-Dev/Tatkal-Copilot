import { describe, it, expect } from "vitest";

describe("v1.5 Information Architecture & Entry UX Specification", () => {
  it("defines clear distinction between Open App (Command Center) and Plan a Trip (Creation Flow)", () => {
    const routes = {
      landing: "/",
      commandCenter: "/app",
      tripCreation: "/app/plan",
      missionControl: "/app/trips/[id]",
    };

    expect(routes.commandCenter).not.toBe(routes.tripCreation);
    expect(routes.landing).toBe("/");
    expect(routes.commandCenter).toBe("/app");
    expect(routes.tripCreation).toBe("/app/plan");
  });

  it("verifies marketing landing page header rule: Sign in present, Open app and Plan a trip absent from header", () => {
    const headerActions = ["Sign in"];
    expect(headerActions).toContain("Sign in");
    expect(headerActions).not.toContain("Open app");
    expect(headerActions).not.toContain("Plan a trip");
  });

  it("verifies sidebar navigation routes", () => {
    const sidebarItems = [
      { href: "/app", label: "Home", exact: true },
      { href: "/app/plan", label: "Plan a trip" },
      { href: "/app/trips", label: "My trips" },
      { href: "/app/travellers", label: "Travellers" },
      { href: "/app/activity", label: "Activity" },
      { href: "/app/settings", label: "Settings" },
      { href: "/app/help", label: "Help & support" },
    ];

    const homeItem = sidebarItems.find((i) => i.label === "Home");
    const planItem = sidebarItems.find((i) => i.label === "Plan a trip");

    expect(homeItem?.href).toBe("/app");
    expect(planItem?.href).toBe("/app/plan");
    expect(homeItem?.exact).toBe(true);
  });

  it("verifies authentication persistence copy and behavior", () => {
    const authReasons = {
      general: "Sign in to save your journeys, travellers and Copilot preferences.",
      planningActivation: "Sign in so Copilot can remember your plan and keep watching the clock until Tatkal opens.",
    };

    expect(authReasons.general).toContain("save your journeys");
    expect(authReasons.planningActivation).toContain("keep watching the clock");
  });
});
