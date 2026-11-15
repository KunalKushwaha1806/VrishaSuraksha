import type { Schedule } from "../models";
import { addDays, istDayKey } from "../time";
import { dosesPerDay } from "./schedule";

export const REFILL_ALERT_DAYS = 5;

export interface RefillForecast {
  unitsPerDay: number;
  /** Whole days of medicine left, or null if the schedule uses none. */
  daysLeft: number | null;
  /** Indian calendar day the last unit is expected to be used. */
  runOutDay: string | null;
  needsRefill: boolean;
}

/** Plain arithmetic: stock divided by daily usage. No model involved. */
export function forecastRefill(stock: number, unitsPerDose: number, schedule: Schedule, now: Date): RefillForecast {
  const unitsPerDay = dosesPerDay(schedule) * unitsPerDose;
  if (unitsPerDay <= 0) return { unitsPerDay: 0, daysLeft: null, runOutDay: null, needsRefill: false };
  const daysLeft = Math.max(0, Math.floor(stock / unitsPerDay));
  return {
    unitsPerDay: Math.round(unitsPerDay * 100) / 100,
    daysLeft,
    runOutDay: addDays(istDayKey(now), daysLeft),
    needsRefill: daysLeft <= REFILL_ALERT_DAYS,
  };
}
