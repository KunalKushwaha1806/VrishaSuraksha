import { smallestGapMinutes } from "./schedule";

export const DEFAULT_SAFE_WINDOW_MIN = 240;
export const MIN_SAFE_WINDOW_MIN = 60;

/**
 * Minimum minutes that should separate two taken doses of the same medicine:
 * four hours, or half the smallest gap in the schedule if that is shorter.
 */
export function safeWindowMinutes(times: string[]): number {
  const gap = smallestGapMinutes(times);
  if (gap === null) return DEFAULT_SAFE_WINDOW_MIN;
  return Math.max(MIN_SAFE_WINDOW_MIN, Math.min(DEFAULT_SAFE_WINDOW_MIN, Math.floor(gap / 2)));
}

/** Returns the conflicting earlier intake time, or null if logging now is safe. */
export function findDoubleDose(takenAt: string[], now: Date, times: string[]): string | null {
  const windowMs = safeWindowMinutes(times) * 60_000;
  const recent = takenAt
    .filter((t) => now.getTime() - new Date(t).getTime() < windowMs && new Date(t).getTime() <= now.getTime())
    .sort();
  return recent.length ? recent[recent.length - 1] : null;
}
