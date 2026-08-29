import type { Plan } from "@/types";
import { parseIntentLocally, buildPlanLocally } from "@/lib/planner";

/**
 * Client-facing planner. Calls the server route (which uses GPT when a key is
 * configured) and always degrades gracefully to the local planner so the demo
 * never breaks in front of an audience.
 */
export async function generatePlan(goal: string): Promise<Plan> {
  try {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
    if (!res.ok) throw new Error(`plan route ${res.status}`);
    const plan = (await res.json()) as Plan;
    if (!plan?.options?.length) throw new Error("malformed plan");
    return plan;
  } catch (err) {
    // Total offline fallback — deterministic, grounded, always available.
    console.warn("[ai] falling back to local planner:", err);
    return buildPlanLocally(parseIntentLocally(goal));
  }
}
