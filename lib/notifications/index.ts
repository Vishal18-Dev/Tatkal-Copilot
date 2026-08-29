import type { SendNotificationRequest, SendNotificationResult } from "./types";
import { sendEmailNotification } from "./email";

/**
 * Server-Side Notification Service.
 * Decouples agent decision ("notify user") from execution channel (in-app, email, whatsapp_demo).
 */
export async function sendNotification(
  req: SendNotificationRequest
): Promise<SendNotificationResult> {
  const channel = req.channel || "in-app";

  switch (channel) {
    case "email": {
      return await sendEmailNotification(req);
    }

    case "whatsapp": {
      return {
        success: true,
        channel: "whatsapp",
        deliveryStatus: "demo_generated",
        subject: req.title,
        previewBody: req.body,
        reason: "WhatsApp notification simulated for demo environment.",
      };
    }

    case "in-app":
    case "push":
    default: {
      return {
        success: true,
        channel: "in-app",
        deliveryStatus: "sent",
        subject: req.title,
        previewBody: req.body,
      };
    }
  }
}
