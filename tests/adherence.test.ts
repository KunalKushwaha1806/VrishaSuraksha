import { describe, expect, it } from "vitest";
import { adherence, adherenceByMedication, streak, weekSummary, type DoseLike } from "@/lib/domain/adherence";
import type { DoseStatus } from "@/lib/models";
import { istToUtc } from "@/lib/time";

const dose = (dayKey: string, time: string, status: DoseStatus, medicationId = "m1"): DoseLike => ({
  dayKey,
  scheduledFor: istToUtc(dayKey, time).toISOString(),
  status,
  medicationId,
});

const NOW = istToUtc("2026-11-15", "12:00");

describe("adherence", () => {
  it("counts taken over taken + missed, excluding informed skips", () => {
    const a = adherence(
      [dose("2026-11-15", "08:00", "TAKEN"), dose("2026-11-14", "08:00", "MISSED"), dose("2026-11-14", "20:00", "SKIPPED")],
      NOW,
    );
    expect(a).toMatchObject({ taken: 1, missed: 1, skipped: 1, due: 2, percent: 50 });
  });

  it("treats long-overdue pending doses as missed but not upcoming ones", () => {
    const a = adherence([dose("2026-11-15", "09:00", "PENDING"), dose("2026-11-15", "11:30", "PENDING")], NOW);
    expect(a.missed).toBe(1);
    expect(a.percent).toBe(0);
  });

  it("returns null percent when nothing was due", () => {
    expect(adherence([], NOW).percent).toBeNull();
  });

  it("groups by medicine", () => {
    const by = adherenceByMedication([dose("2026-11-15", "08:00", "TAKEN", "a"), dose("2026-11-15", "08:00", "MISSED", "b")], NOW);
    expect(by.a.percent).toBe(100);
    expect(by.b.percent).toBe(0);
  });
});

describe("streak", () => {
  it("counts consecutive fully-logged days and ignores an unfinished today", () => {
    const doses = [
      dose("2026-11-15", "08:00", "TAKEN"),
      dose("2026-11-15", "20:00", "PENDING"), // later today
      dose("2026-11-14", "08:00", "TAKEN"),
      dose("2026-11-14", "20:00", "SKIPPED"),
      dose("2026-11-13", "08:00", "TAKEN"),
      dose("2026-11-12", "08:00", "MISSED"),
      dose("2026-11-11", "08:00", "TAKEN"),
    ];
    expect(streak(doses, NOW)).toBe(2);
  });

  it("includes today once every dose is logged", () => {
    expect(streak([dose("2026-11-15", "08:00", "TAKEN"), dose("2026-11-14", "08:00", "TAKEN")], NOW)).toBe(2);
  });

  it("treats days with nothing scheduled as neutral", () => {
    expect(streak([dose("2026-11-14", "08:00", "TAKEN"), dose("2026-11-12", "08:00", "TAKEN")], NOW)).toBe(2);
  });

  it("is zero after a miss yesterday", () => {
    expect(streak([dose("2026-11-14", "08:00", "MISSED")], NOW)).toBe(0);
  });
});

describe("weekSummary", () => {
  it("returns seven days, oldest first", () => {
    const week = weekSummary([dose("2026-11-15", "08:00", "TAKEN")], NOW);
    expect(week).toHaveLength(7);
    expect(week[0].day).toBe("2026-11-09");
    expect(week[6]).toMatchObject({ day: "2026-11-15", scheduled: 1, percent: 100 });
  });
});
