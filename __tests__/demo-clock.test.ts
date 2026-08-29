import { describe, it, expect, vi } from "vitest";
import { DemoClock, DEMO_ENVIRONMENT_TIMELINE, type DemoEnvironmentBeat, type DemoClockStatus } from "@/lib/demo-clock";

describe("Demo Clock (v1.4 Environmental Beats)", () => {
  describe("Timeline", () => {
    it("has 6 environmental beats", () => {
      expect(DEMO_ENVIRONMENT_TIMELINE.length).toBe(6);
    });

    it("starts with monitoring_started and ends with primary_unavailable", () => {
      expect(DEMO_ENVIRONMENT_TIMELINE[0].event).toBe("monitoring_started");
      expect(DEMO_ENVIRONMENT_TIMELINE[DEMO_ENVIRONMENT_TIMELINE.length - 1].event).toBe("primary_unavailable");
    });

    it("contains pure environmental beats only (no trigger flags)", () => {
      for (const beat of DEMO_ENVIRONMENT_TIMELINE) {
        expect(beat).not.toHaveProperty("triggerBooking");
        expect(beat).not.toHaveProperty("triggerBackup");
        expect(beat).toHaveProperty("event");
        expect(beat).toHaveProperty("userActive");
        expect(beat).toHaveProperty("primaryAvailable");
      }
    });

    it("simulates passenger inactivity at beat 3", () => {
      const inactiveBeat = DEMO_ENVIRONMENT_TIMELINE.find((b) => b.event === "user_inactive");
      expect(inactiveBeat).toBeDefined();
      expect(inactiveBeat?.userActive).toBe(false);
    });

    it("simulates primary quota exhaustion at beat 5", () => {
      const primaryFailBeat = DEMO_ENVIRONMENT_TIMELINE.find((b) => b.event === "primary_unavailable");
      expect(primaryFailBeat).toBeDefined();
      expect(primaryFailBeat?.primaryAvailable).toBe(false);
    });
  });

  describe("Clock Controls", () => {
    it("starts in idle state", () => {
      const clock = new DemoClock({
        onBeat: vi.fn(),
        onComplete: vi.fn(),
        onStatusChange: vi.fn(),
      });
      expect(clock.currentStatus).toBe("idle");
      expect(clock.currentIndex).toBe(0);
      clock.destroy();
    });

    it("step advances one environmental beat", async () => {
      const beats: DemoEnvironmentBeat[] = [];
      const clock = new DemoClock({
        onBeat: (beat) => { beats.push(beat); },
        onComplete: vi.fn(),
        onStatusChange: vi.fn(),
      });
      await clock.step();
      expect(beats.length).toBe(1);
      expect(beats[0].event).toBe("monitoring_started");
      expect(clock.currentIndex).toBe(1);
      clock.destroy();
    });

    it("reset brings clock back to beat 0", async () => {
      const clock = new DemoClock({
        onBeat: vi.fn(),
        onComplete: vi.fn(),
        onStatusChange: vi.fn(),
      });
      await clock.step();
      await clock.step();
      clock.reset();
      expect(clock.currentIndex).toBe(0);
      expect(clock.currentStatus).toBe("idle");
      clock.destroy();
    });

    it("completes after all environmental beats", async () => {
      const onComplete = vi.fn();
      const statusChanges: DemoClockStatus[] = [];
      const clock = new DemoClock({
        onBeat: vi.fn(),
        onComplete,
        onStatusChange: (s) => statusChanges.push(s),
      });

      for (let i = 0; i < DEMO_ENVIRONMENT_TIMELINE.length; i++) {
        await clock.step();
      }

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(statusChanges).toContain("complete");
      clock.destroy();
    });
  });
});
