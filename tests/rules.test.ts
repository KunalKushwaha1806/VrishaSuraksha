import { describe, expect, it } from "vitest";
import { findDoubleDose, safeWindowMinutes } from "@/lib/domain/doubleDose";
import { LADDERS, planEscalation } from "@/lib/domain/escalation";
import { can, canSee, visibilityOf } from "@/lib/domain/permissions";
import { forecastRefill, REFILL_ALERT_DAYS } from "@/lib/domain/refill";
import { istToUtc } from "@/lib/time";

const daily = (times: string[]) => ({ times, days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null });

describe("refill forecast", () => {
  const now = istToUtc("2026-11-15", "10:00");

  it("divides stock by daily usage", () => {
    const f = forecastRefill(20, 1, daily(["09:00", "21:00"]), now);
    expect(f).toMatchObject({ unitsPerDay: 2, daysLeft: 10, runOutDay: "2026-11-25", needsRefill: false });
  });

  it("flags a refill within the alert window", () => {
    const f = forecastRefill(REFILL_ALERT_DAYS, 1, daily(["09:00"]), now);
    expect(f.needsRefill).toBe(true);
  });

  it("accounts for units per dose and weekly schedules", () => {
    const weekly = { ...daily(["10:00"]), days: [0] };
    expect(forecastRefill(4, 1, weekly, now).daysLeft).toBe(28);
    expect(forecastRefill(10, 2, daily(["09:00"]), now).daysLeft).toBe(5);
  });

  it("handles empty stock", () => {
    expect(forecastRefill(0, 1, daily(["09:00"]), now)).toMatchObject({ daysLeft: 0, needsRefill: true });
  });
});

describe("escalation ladder", () => {
  const t0 = istToUtc("2026-11-15", "09:00");
  const offsets = (c: "high" | "normal" | "low") =>
    planEscalation(c, t0, t0).map((s) => [s.kind, (s.dueAt.getTime() - t0.getTime()) / 60_000]);

  it("follows elder, elder, caretaker, family for normal medicines", () => {
    expect(offsets("normal")).toEqual([
      ["dose_due", 0],
      ["elder_renudge", 15],
      ["caretaker_alert", 30],
      ["family_alert", 60],
      ["mark_missed", 90],
    ]);
  });

  it("uses shorter gaps for high-criticality medicines", () => {
    const high = offsets("high");
    expect(high.find(([k]) => k === "caretaker_alert")?.[1]).toBeLessThan(30);
    expect(high.find(([k]) => k === "family_alert")?.[1]).toBeLessThan(60);
  });

  it("never alerts family for low-criticality medicines", () => {
    expect(LADDERS.low.some((s) => s.kind === "family_alert")).toBe(false);
  });

  it("drops stale steps but always keeps the missed marker", () => {
    const late = new Date(t0.getTime() + 45 * 60_000);
    const kinds = planEscalation("normal", t0, late).map((s) => s.kind);
    expect(kinds).toEqual(["family_alert", "mark_missed"]);
  });
});

describe("double-dose guard", () => {
  const now = new Date("2026-11-15T05:00:00Z");

  it("defaults to a four hour window for once-daily medicines", () => {
    expect(safeWindowMinutes(["09:00"])).toBe(240);
  });

  it("uses half the smallest gap when doses are close together", () => {
    expect(safeWindowMinutes(["08:00", "12:00", "16:00"])).toBe(120);
    expect(safeWindowMinutes(["08:00", "08:30"])).toBe(60);
  });

  it("flags a second intake inside the window", () => {
    expect(findDoubleDose(["2026-11-15T04:00:00.000Z"], now, ["09:00"])).toBe("2026-11-15T04:00:00.000Z");
  });

  it("allows intakes outside the window", () => {
    expect(findDoubleDose(["2026-11-14T20:00:00.000Z"], now, ["09:00", "21:00"])).toBeNull();
  });
});

describe("role permissions", () => {
  it("gives the elder every privacy control", () => {
    for (const p of ["privacy:manage", "members:revoke", "share:manage", "activity:read", "data:export", "data:delete"] as const) {
      expect(can("ELDER", p)).toBe(true);
      expect(can("CARETAKER", p)).toBe(false);
      expect(can("FAMILY", p)).toBe(false);
    }
  });

  it("lets caretakers manage care", () => {
    for (const p of ["meds:write", "doses:log", "appointments:write", "prescription:scan", "members:invite"] as const) {
      expect(can("CARETAKER", p)).toBe(true);
    }
  });

  it("keeps family read-mostly", () => {
    expect(can("FAMILY", "meds:write")).toBe(false);
    expect(can("FAMILY", "doses:log")).toBe(false);
    expect(can("FAMILY", "voice:listen")).toBe(false);
    expect(can("FAMILY", "reactions:send")).toBe(true);
    expect(can("FAMILY", "refill:claim")).toBe(true);
  });

  it("applies per-member visibility to family only", () => {
    const vis = { doses: false, missedReasons: false, symptoms: false, appointments: true, stock: false };
    expect(canSee({ role: "FAMILY", visibility: vis }, "doses")).toBe(false);
    expect(canSee({ role: "FAMILY", visibility: vis }, "appointments")).toBe(true);
    expect(visibilityOf({ role: "CARETAKER", visibility: vis }).doses).toBe(true);
  });
});
