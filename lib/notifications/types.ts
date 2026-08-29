import type { NotificationChannel, NotificationDeliveryStatus } from "@/types";

export interface SendNotificationRequest {
  tripId?: string;
  channel: NotificationChannel;
  priority?: "low" | "medium" | "high";
  title: string;
  body: string;
  reason?: string;
  recipientEmail?: string;
  notificationKey?: string;
  journeyDetails?: {
    from: string;
    to: string;
    trainName: string;
    travelClass: string;
    tatkalOpensAt: string;
    backupTrainName?: string;
  };
}

export interface SendNotificationResult {
  success: boolean;
  channel: NotificationChannel;
  deliveryStatus: NotificationDeliveryStatus;
  notificationKey?: string;
  recipientEmail?: string;
  subject?: string;
  previewBody?: string;
  reason?: string;
  error?: string;
}
