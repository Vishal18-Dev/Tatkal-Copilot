import type { SendNotificationRequest, SendNotificationResult } from "./types";

/**
 * Server-side email delivery adapter.
 * Uses native fetch to connect to Resend or custom REST API providers.
 * Safely handles EMAIL_DEMO_MODE=true and missing credentials without crashing.
 */
export async function sendEmailNotification(
  req: SendNotificationRequest
): Promise<SendNotificationResult> {
  const apiKey = process.env.EMAIL_API_KEY?.trim();
  const isDemoMode = process.env.EMAIL_DEMO_MODE === "true" || (!apiKey && process.env.EMAIL_DEMO_MODE !== "false");
  const fromAddress = process.env.EMAIL_FROM || "Tatkal Copilot <noreply@tatkalcopilot.com>";
  const recipient = req.recipientEmail || "passenger@example.com";

  const subject = req.title || "Tatkal Copilot Alert";
  const contentHtml = buildEmailTemplate(req);

  // 1. Demo Mode -> return demo_generated payload safely
  if (isDemoMode) {
    return {
      success: true,
      channel: "email",
      deliveryStatus: "demo_generated",
      recipientEmail: recipient,
      subject,
      previewBody: req.body,
      reason: apiKey
        ? "EMAIL_DEMO_MODE enabled — email payload generated for demonstration."
        : "Email credentials not configured — simulated payload generated for demonstration.",
    };
  }

  // 2. Real API delivery via Resend REST API (zero dependencies required)
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipient],
        subject,
        html: contentHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[email-service] Provider HTTP error:", res.status, errText);
      return {
        success: false,
        channel: "email",
        deliveryStatus: "email_unavailable",
        recipientEmail: recipient,
        error: `Provider HTTP ${res.status}: ${errText}`,
      };
    }

    return {
      success: true,
      channel: "email",
      deliveryStatus: "sent",
      recipientEmail: recipient,
      subject,
      previewBody: req.body,
    };
  } catch (err) {
    console.error("[email-service] Failed to deliver email:", err);
    return {
      success: false,
      channel: "email",
      deliveryStatus: "email_unavailable",
      recipientEmail: recipient,
      error: String(err),
    };
  }
}

function buildEmailTemplate(req: SendNotificationRequest): string {
  const details = req.journeyDetails;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #0f172a; padding: 20px; }
          .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; }
          .badge { display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
          .title { font-size: 20px; font-weight: 700; margin-top: 12px; color: #0f172a; }
          .body-text { font-size: 15px; line-height: 1.6; color: #475569; margin-top: 12px; }
          .route-box { background: #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 10px; margin-top: 16px; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">Tatkal Copilot Alert</span>
          <h1 class="title">${req.title}</h1>
          <p class="body-text">${req.body}</p>
          ${
            details
              ? `
            <div class="route-box">
              <strong>${details.from} → ${details.to}</strong><br>
              Primary: ${details.trainName} (${details.travelClass})<br>
              ${details.backupTrainName ? `Backup: ${details.backupTrainName}<br>` : ""}
              Tatkal window: ${details.tatkalOpensAt}
            </div>
          `
              : ""
          }
          <a href="https://tatkalcopilot.com/app" class="cta-btn">Open Mission Control</a>
          <div class="footer">Tatkal Copilot · AI Agent Monitoring</div>
        </div>
      </body>
    </html>
  `;
}
