/**
 * Time helpers. Everything is stored as UTC ISO strings; the care circle
 * lives in India Standard Time (UTC+05:30, no daylight saving), so local
 * calendar maths uses a fixed offset and display uses Intl.
 */
export const TIME_ZONE = "Asia/Kolkata";
export const IST_OFFSET_MIN = 330;
const MINUTE = 60_000;
export const DAY_MS = 24 * 60 * MINUTE;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE);
}

/** Calendar parts of a UTC instant, as seen on a clock in India. */
export function istParts(date: Date) {
  const t = new Date(date.getTime() + IST_OFFSET_MIN * MINUTE);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
    hours: t.getUTCHours(),
    minutes: t.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of the Indian calendar day containing this instant. */
export function istDayKey(date: Date): string {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Converts an Indian calendar day and "HH:MM" clock time to a UTC instant. */
export function istToUtc(dayKey: string, hhmm: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MIN * MINUTE);
}

export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Day of week (0 = Sunday) for an Indian calendar day. */
export function weekdayOf(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Compact, Firestore-safe stamp used inside deterministic document ids. */
export function compactStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function formatTime(iso: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}
