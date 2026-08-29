import { describe, it, expect } from "vitest";
import { validateAgentDecision, type ProposedAgentDecision } from "@/lib/action-validator";
import { sendNotification } from "@/lib/notifications";
import type { Trip } from "@/types";

const mockTrip: Trip = {
  id: "trip_demo_1",
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

describe("v1.6 Agent Escalation & Notification System Specification", () => {
  it("validates notify_user action for inactive user escalation", () => {
    const decision: ProposedAgentDecision = {
      action: "notify_user",
      reason: "Passenger inactive shortly before Tatkal window. Escalating via email.",
      toolCall: {
        name: "notifyUser",
        arguments: {
          channel: "email",
          priority: "high",
          title: "Tatkal Window Opening Soon",
          message: "Your Tatkal window opens in 10 minutes.",
          notificationKey: "tatkal_warning_10m",
        },
      },
      source: "gpt",
    };

    const result = validateAgentDecision(decision, mockTrip, new Set());
    expect(result.valid).toBe(true);
    expect(result.code).toBe("ok");
  });

  it("suppresses duplicate notifications with deterministic notification keys", () => {
    const decision: ProposedAgentDecision = {
      action: "notify_user",
      reason: "Duplicate evaluation attempt",
      toolCall: {
        name: "notifyUser",
        arguments: {
          channel: "email",
          title: "Tatkal Window Opening Soon",
          notificationKey: "tatkal_warning_10m",
        },
      },
      source: "local",
    };

    const sentKeys = new Set(["key:tatkal_warning_10m"]);
    const result = validateAgentDecision(decision, mockTrip, sentKeys);

    expect(result.valid).toBe(false);
    expect(result.code).toBe("duplicate_notification");
    expect(result.reason).toContain("Notification suppressed");
  });

  it("handles demo email payload generation when EMAIL_DEMO_MODE=true", async () => {
    process.env.EMAIL_DEMO_MODE = "true";

    const res = await sendNotification({
      channel: "email",
      priority: "high",
      title: "Your Tatkal window opens in 10 minutes",
      body: "Your Mumbai → New Delhi plan is ready.",
      recipientEmail: "manoj@example.com",
    });

    expect(res.success).toBe(true);
    expect(res.channel).toBe("email");
    expect(res.deliveryStatus).toBe("demo_generated");
    expect(res.recipientEmail).toBe("manoj@example.com");
    expect(res.subject).toBe("Your Tatkal window opens in 10 minutes");
  });

  it("handles missing email provider credentials gracefully without crashing", async () => {
    process.env.EMAIL_DEMO_MODE = "false";
    const originalKey = process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_API_KEY;

    const res = await sendNotification({
      channel: "email",
      priority: "high",
      title: "Tatkal Warning",
      body: "Test body",
      recipientEmail: "test@example.com",
    });

    expect(res.channel).toBe("email");
    expect(res.deliveryStatus).toBe("email_unavailable");
    expect(res.success).toBe(false);

    if (originalKey) process.env.EMAIL_API_KEY = originalKey;
  });

  it("verifies security rule: secrets are server-side only and not exposed in client exports", () => {
    expect(process.env.NEXT_PUBLIC_EMAIL_API_KEY).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_OPENAI_API_KEY).toBeUndefined();
  });
});
