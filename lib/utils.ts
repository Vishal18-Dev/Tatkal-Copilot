import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "845" mins -> "14h 05m" */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** "06:40" + dayOffset -> "06:40 · tomorrow" */
export function formatArrival(time: string, dayOffset: number): string {
  if (dayOffset <= 0) return `${time} · today`;
  if (dayOffset === 1) return `${time} · tomorrow`;
  return `${time} · +${dayOffset} days`;
}

/** 60 -> "01:00" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Indian rupee formatting: 2360 -> "₹2,360" */
export function formatFare(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Compare "HH:MM" strings as minutes-of-day. */
export function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Deadline check accounting for a next-morning arrival. */
export function arrivesBefore(
  arrival: string,
  arrivalDayOffset: number,
  deadline: string | null
): boolean {
  if (!deadline) return true;
  // Deadline is understood as "tomorrow morning" for overnight journeys.
  return timeToMins(arrival) <= timeToMins(deadline) || arrivalDayOffset > 1;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
