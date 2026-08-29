import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/notifications";
import type { SendNotificationRequest } from "@/lib/notifications/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: SendNotificationRequest;
  try {
    body = (await req.json()) as SendNotificationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const result = await sendNotification(body);
  return NextResponse.json(result);
}
