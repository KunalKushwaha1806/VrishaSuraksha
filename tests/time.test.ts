import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutes,
  compactStamp,
  formatDate,
  formatDateTime,
  formatTime,
  istDayKey,
  istParts,
  istToUtc,
  weekdayOf,
} from "@/lib/time";

describe("Time & IST Conversion Helpers", () => {
  it("converts between IST and UTC instants accurately", () => {
    // 09:00 AM IST on 2026-11-15 should be 03:30 AM UTC
    const utc = istToUtc("2026-11-15", "09:00");
    expect(utc.toISOString()).toBe("2026-11-15T03:30:00.000Z");

    const parts = istParts(utc);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(11);
    expect(parts.day).toBe(15);
    expect(parts.hours).toBe(9);
    expect(parts.minutes).toBe(0);

    expect(istDayKey(utc)).toBe("2026-11-15");
  });

  it("handles day additions and date math correctly", () => {
    expect(addDays("2026-11-15", 1)).toBe("2026-11-16");
    expect(addDays("2026-11-15", -5)).toBe("2026-11-10");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("identifies day of week correctly (Sunday = 0)", () => {
    // 2026-11-15 is a Sunday
    expect(weekdayOf("2026-11-15")).toBe(0);
    // 2026-11-16 is a Monday
    expect(weekdayOf("2026-11-16")).toBe(1);
  });

  it("creates compact stamp without punctuation", () => {
    const d = new Date("2026-11-15T09:00:00.000Z");
    expect(compactStamp(d)).toBe("20261115T090000Z");
  });

  it("adds minutes without altering original date", () => {
    const original = new Date("2026-11-15T10:00:00.000Z");
    const later = addMinutes(original, 30);
    expect(later.toISOString()).toBe("2026-11-15T10:30:00.000Z");
    expect(original.toISOString()).toBe("2026-11-15T10:00:00.000Z");
  });

  it("formats dates and times for human readability", () => {
    const iso = "2026-11-15T03:30:00.000Z"; // 09:00 IST
    expect(formatDate(iso)).toBeDefined();
    expect(formatTime(iso)).toBeDefined();
    expect(formatDateTime(iso)).toBeDefined();
  });
});
