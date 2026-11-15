import type { DoseStatus } from "../models";
import { addDays, istDayKey } from "../time";

export interface DoseLike {
  dayKey: string;
  scheduledFor: string;
  status: DoseStatus;
  medicationId?: string;
}

/** A pending dose this long past its time counts as missed for statistics. */
export const OVERDUE_AFTER_MIN = 90;

export interface Adherence {
  taken: number;
  missed: number;
  skipped: number;
  /** Doses that were due (taken + missed). Skips are the elder's informed choice, so they are excluded. */
  due: number;
  /** 0-100, or null when nothing was due yet. */
  percent: number | null;
}

function isOverdue(d: DoseLike, now: Date): boolean {
  return d.status === "PENDING" && new Date(d.scheduledFor).getTime() + OVERDUE_AFTER_MIN * 60_000 <= now.getTime();
}

export function adherence(doses: DoseLike[], now: Date): Adherence {
  let taken = 0;
  let missed = 0;
  let skipped = 0;
  for (const d of doses) {
    if (d.status === "TAKEN") taken++;
    else if (d.status === "SKIPPED") skipped++;
    else if (d.status === "MISSED" || isOverdue(d, now)) missed++;
  }
  const due = taken + missed;
  return { taken, missed, skipped, due, percent: due === 0 ? null : Math.round((taken / due) * 100) };
}

/** Adherence grouped by medication id. */
export function adherenceByMedication(doses: DoseLike[], now: Date): Record<string, Adherence> {
  const groups = new Map<string, DoseLike[]>();
  for (const d of doses) {
    const key = d.medicationId ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return Object.fromEntries([...groups].map(([k, v]) => [k, adherence(v, now)]));
}

const isLogged = (s: DoseStatus) => s === "TAKEN" || s === "SKIPPED";

/**
 * Consecutive Indian calendar days on which every scheduled dose was logged
 * (taken or consciously skipped). Computed from the dose log, never stored.
 * Today counts once complete; an unfinished today does not break the streak.
 * Days with nothing scheduled are neutral.
 */
export function streak(doses: DoseLike[], now: Date, lookbackDays = 60): number {
  const byDay = new Map<string, DoseLike[]>();
  for (const d of doses) byDay.set(d.dayKey, [...(byDay.get(d.dayKey) ?? []), d]);

  const today = istDayKey(now);
  let count = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const day = addDays(today, -i);
    const list = byDay.get(day);
    if (!list || list.length === 0) continue;
    const complete = list.every((d) => isLogged(d.status));
    if (complete) {
      count++;
      continue;
    }
    if (i === 0) continue; // today is still in progress
    break;
  }
  return count;
}

/** Per-day completion for the last `days` days, newest last: used for the weekly summary. */
export function weekSummary(doses: DoseLike[], now: Date, days = 7) {
  const today = istDayKey(now);
  return Array.from({ length: days }, (_, idx) => {
    const day = addDays(today, idx - (days - 1));
    const list = doses.filter((d) => d.dayKey === day);
    const a = adherence(list, now);
    return { day, scheduled: list.length, ...a };
  });
}
