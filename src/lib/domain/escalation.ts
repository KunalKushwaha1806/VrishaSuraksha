import type { Criticality, JobKind } from "../models";

export interface LadderStep {
  kind: JobKind;
  /** Minutes after the scheduled dose time. */
  offsetMin: number;
}

/**
 * Escalation ladder per criticality. A logged dose cancels every pending step.
 * - high: tighter gaps, family is told quickly.
 * - normal: elder nudge at T+0, re-nudge T+15, caretaker T+30, family T+60.
 * - low: gentler, and the family step is skipped entirely.
 */
export const LADDERS: Record<Criticality, readonly LadderStep[]> = {
  high: [
    { kind: "dose_due", offsetMin: 0 },
    { kind: "elder_renudge", offsetMin: 10 },
    { kind: "caretaker_alert", offsetMin: 20 },
    { kind: "family_alert", offsetMin: 40 },
    { kind: "mark_missed", offsetMin: 60 },
  ],
  normal: [
    { kind: "dose_due", offsetMin: 0 },
    { kind: "elder_renudge", offsetMin: 15 },
    { kind: "caretaker_alert", offsetMin: 30 },
    { kind: "family_alert", offsetMin: 60 },
    { kind: "mark_missed", offsetMin: 90 },
  ],
  low: [
    { kind: "dose_due", offsetMin: 0 },
    { kind: "elder_renudge", offsetMin: 30 },
    { kind: "caretaker_alert", offsetMin: 60 },
    { kind: "mark_missed", offsetMin: 120 },
  ],
};

export interface PlannedStep {
  kind: JobKind;
  dueAt: Date;
}

/**
 * Steps to schedule for a dose. Steps already more than `graceMin` in the past
 * are dropped so a late generator run never floods anyone with stale nudges;
 * the final "mark missed" step is always kept so the log stays accurate.
 */
export function planEscalation(criticality: Criticality, scheduledFor: Date, now: Date, graceMin = 5): PlannedStep[] {
  const cutoff = now.getTime() - graceMin * 60_000;
  return LADDERS[criticality]
    .map((s) => ({ kind: s.kind, dueAt: new Date(scheduledFor.getTime() + s.offsetMin * 60_000) }))
    .filter((s) => s.kind === "mark_missed" || s.dueAt.getTime() >= cutoff);
}
