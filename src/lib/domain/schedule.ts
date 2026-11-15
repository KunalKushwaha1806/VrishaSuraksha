import type { Schedule } from "../models";
import { addDays, istDayKey, istToUtc, weekdayOf } from "../time";

export interface Occurrence {
  dayKey: string;
  at: Date;
}

/** Every scheduled dose time in [from, to), computed on the Indian calendar. */
export function occurrencesBetween(schedule: Schedule, from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  const times = [...schedule.times].sort();
  let day = istDayKey(from);
  const lastDay = istDayKey(to);
  while (day <= lastDay) {
    const inRange = day >= schedule.startDate && (!schedule.endDate || day <= schedule.endDate);
    if (inRange && schedule.days.includes(weekdayOf(day))) {
      for (const t of times) {
        const at = istToUtc(day, t);
        if (at >= from && at < to) out.push({ dayKey: day, at });
      }
    }
    day = addDays(day, 1);
  }
  return out;
}

/** Average doses per day over a week, e.g. twice daily on weekdays = 10/7. */
export function dosesPerDay(schedule: Schedule): number {
  return (schedule.times.length * schedule.days.length) / 7;
}

/** Smallest gap between two daily dose times, in minutes (wrapping past midnight). */
export function smallestGapMinutes(times: string[]): number | null {
  if (times.length < 2) return null;
  const mins = times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  });
  mins.sort((a, b) => a - b);
  let gap = 24 * 60 - mins[mins.length - 1] + mins[0];
  for (let i = 1; i < mins.length; i++) gap = Math.min(gap, mins[i] - mins[i - 1]);
  return gap;
}
