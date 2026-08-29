import { describe, it, expect } from "vitest";
import { TatkalAgent } from "@/lib/tatkal-agent";
import { validateAgentDecision } from "@/lib/action-validator";
import type { DemoEnvironmentBeat } from "@/lib/demo-clock";
import type { Trip } from "@/types";

const mockTrip: Trip = {
  id: "trip_inactivity_test",
  status: "upcoming",
  from: "Mumbai CSMT",
  fromCode: "CSMT",
  to: "New Delhi",
  toCode: "NDLS",
  dateLabel: "Tomorrow",
  trainName: "12951 · Mumbai Rajdhani",
  travelClass: "3A",
  travellerIds: ["p1"],
  boardingStationName: "Mumbai CSMT",
  arrivalDisplay: "08:30",
  fare: 2150,
  mode: "assisted",
  createdAt: new Date().toISOString(),
  agentState: "t_minus_10",
  agentEnabled: true,
  tatkalOpensAtLabel: "10:00 AM",
  primary: {
    optionId: "o1",
    trainName: "12951 · Mumbai Rajdhani",
    travelClass: "3A",
    boardingStationName: "Mumbai CSMT",
    departureDisplay: "17:00",
    arrivalDisplay: "08:30",
    level: "High",
    fare: 2150,
  },
  backup: {
    optionId: "o2",
    trainName: "12953 · August Kranti",
    travelClass: "3A",
    boardingStationName: "Mumbai CSMT",
    departureDisplay: "17:15",
    arrivalDisplay: "09:45",
    level: "Medium",
    fare: 2150,
  },
  readinessDone: ["travellers", "train"],
  planNotifications: [],
  channelPreferences: {
    inApp: true,
    email: true,
    whatsappDemo: false,
  },
};

describe("v1.6 Simulate Inactivity Integration & Agent Autonomy Tests", () => {
  it("Test 1 & 2: Simulate Inactivity dispatches user_inactive beat and agent observes userActive: false", () => {
    let currentTrip = { ...mockTrip };
    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const inactivityBeat: DemoEnvironmentBeat = {
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive · 10 minutes to Tatkal window",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    };

    const obs = agent.observe(inactivityBeat);
    expect(obs.userActive).toBe(false);
    expect(obs.envEvent).toBe("user_inactive");
    expect(obs.secondsRemaining).toBe(600);
  });

  it("Test 3 & 4: Agent evaluates user_inactive, decides notify_user, validator approves, tool executes", async () => {
    let currentTrip = { ...mockTrip };
    let notificationPushed = false;

    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => { notificationPushed = true; },
      getTravellers: () => [],
    });

    const inactivityBeat: DemoEnvironmentBeat = {
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive · 10 minutes to Tatkal window",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    };

    const { decision, validation, executedTool } = await agent.tick(inactivityBeat);

    expect(decision.action).toBe("notify_user");
    expect(validation.valid).toBe(true);
    expect(executedTool).toBe("notifyUser");
    expect(notificationPushed).toBe(true);
    expect(currentTrip.planNotifications.length).toBe(1);
    expect(currentTrip.planNotifications[0].channel).toBe("email");
  });

  it("Test 5: Identical inactivity beat evaluated twice is suppressed by notification key deduplication", async () => {
    let currentTrip = { ...mockTrip };
    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const inactivityBeat: DemoEnvironmentBeat = {
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive · 10 minutes to Tatkal window",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    };

    // First tick sends notification
    await agent.tick(inactivityBeat);
    expect(currentTrip.planNotifications.length).toBe(1);

    // Second tick with same beat is suppressed by deduplication
    const res2 = await agent.tick(inactivityBeat);
    expect(res2.validation.valid).toBe(false);
    expect(res2.validation.code).toBe("duplicate_notification");
    expect(currentTrip.planNotifications.length).toBe(1);
  });

  it("Test 6: Reset inactivity restores environment userActive to true", () => {
    let currentTrip = { ...mockTrip };
    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const activeBeat: DemoEnvironmentBeat = {
      event: "monitoring_started",
      secondsRemaining: 1800,
      countdownLabel: "30:00",
      description: "Passenger active · Monitoring journey",
      windowOpen: false,
      userActive: true,
      primaryAvailable: true,
    };

    const obs = agent.observe(activeBeat);
    expect(obs.userActive).toBe(true);
    expect(obs.envEvent).toBe("monitoring_started");
  });

  it("Test 7 & 8: Local fallback baseline works predictably without OpenAI credentials", async () => {
    let currentTrip = { ...mockTrip };
    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const activeBeat: DemoEnvironmentBeat = {
      event: "monitoring_started",
      secondsRemaining: 1800,
      countdownLabel: "30:00",
      description: "Passenger active · Monitoring journey",
      windowOpen: false,
      userActive: true,
      primaryAvailable: true,
    };

    const obs = agent.observe(activeBeat);
    // Active user at T-30 should yield "none"
    const decision = agent["evaluateLocally"](obs);
    expect(decision.action).toBe("none");
  });

  it("Test 9: Uses custom trip.userEmail when delivering notification", async () => {
    let currentTrip = { ...mockTrip, userEmail: "vishal@example.com" };
    const agent = new TatkalAgent(currentTrip, {
      updateTrip: (id, patch) => { currentTrip = { ...currentTrip, ...patch }; },
      logActivity: () => {},
      pushNotification: () => {},
      getTravellers: () => [],
    });

    const inactivityBeat: DemoEnvironmentBeat = {
      event: "user_inactive",
      secondsRemaining: 600,
      countdownLabel: "10:00",
      description: "Passenger inactive · 10 minutes to Tatkal window",
      windowOpen: false,
      userActive: false,
      primaryAvailable: true,
    };

    await agent.tick(inactivityBeat);
    expect(currentTrip.planNotifications.length).toBe(1);
    expect(currentTrip.planNotifications[0].recipientEmail).toBe("vishal@example.com");
  });
});
