import { describe, expect, it } from "vitest";
import { dosesPerDay, occurrencesBetween, smallestGapMinutes } from "@/lib/domain/schedule";
import { istDayKey, istToUtc } from "@/lib/time";

describe("time helpers (India Standard Time)", () => {
  it("converts an Indian clock time to UTC", () => {
    expect(istToUtc("2026-11-15", "09:00").toISOString()).toBe("2026-11-15T03:30:00.000Z");
  });

  it("uses the Indian calendar day, not the UTC day", () => {
    // 20:00 UTC on the 14th is 01:30 on the 15th in India.
    expect(istDayKey(new Date("2026-11-14T20:00:00Z"))).toBe("2026-11-15");
  });
});

describe("occurrencesBetween", () => {
  const schedule = { times: ["21:00", "09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-11-15", endDate: null };

  it("lists every dose time in the window, sorted", () => {
    const from = istToUtc("2026-11-15", "00:00");
    const to = istToUtc("2026-11-17", "00:00");
    const out = occurrencesBetween(schedule, from, to).map((o) => o.at.toISOString());
    expect(out).toEqual([
      "2026-11-15T03:30:00.000Z",
      "2026-11-15T15:30:00.000Z",
      "2026-11-16T03:30:00.000Z",
      "2026-11-16T15:30:00.000Z",
    ]);
  });

  it("respects the days of the week", () => {
    const sundaysOnly = { ...schedule, times: ["10:00"], days: [0] };
    // 2026-11-15 is a Sunday.
    const out = occurrencesBetween(sundaysOnly, istToUtc("2026-11-14", "00:00"), istToUtc("2026-11-21", "23:59"));
    expect(out.map((o) => o.dayKey)).toEqual(["2026-11-15"]);
  });

  it("respects start and end dates", () => {
    const short = { ...schedule, times: ["09:00"], startDate: "2026-11-16", endDate: "2026-11-17" };
    const out = occurrencesBetween(short, istToUtc("2026-11-14", "00:00"), istToUtc("2026-11-20", "00:00"));
    expect(out.map((o) => o.dayKey)).toEqual(["2026-11-16", "2026-11-17"]);
  });

  it("excludes the end of the window", () => {
    const at = istToUtc("2026-11-15", "09:00");
    expect(occurrencesBetween(schedule, at, at)).toEqual([]);
  });
});

describe("schedule maths", () => {
  it("averages doses per day across the week", () => {
    expect(dosesPerDay({ times: ["09:00", "21:00"], days: [1, 2, 3, 4, 5], startDate: "2026-01-01", endDate: null })).toBeCloseTo(10 / 7);
  });

  it("finds the smallest gap, wrapping past midnight", () => {
    expect(smallestGapMinutes(["09:00"])).toBeNull();
    expect(smallestGapMinutes(["08:00", "14:00", "20:00"])).toBe(360);
    expect(smallestGapMinutes(["23:30", "00:30"])).toBe(60);
  });
});
