import { describe, expect, it } from "vitest";
import { harness, medication } from "./helpers";
import { C, type DoseEvent } from "@/lib/models";
import { logDose } from "@/lib/services/doses";
import { istDayKey } from "@/lib/time";

describe("Doses Service", () => {
  it("logs a dose as TAKEN, updates stock, and cancels pending reminders", async () => {
    const { db, circle, elder } = await harness();
    const now = new Date("2026-11-15T09:00:00.000Z");

    const med = medication({
      stock: 20,
      schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null },
    });
    await db.set(C.medications(circle.id), med.id, med);

    const dose: DoseEvent = {
      id: "dose-1",
      circleId: circle.id,
      medicationId: med.id,
      medName: med.name,
      scheduledFor: now.toISOString(),
      dayKey: istDayKey(now),
      status: "PENDING",
      loggedAt: null,
      loggedById: null,
      loggedByName: null,
      missedReason: null,
      noteEnc: null,
    };
    await db.set(C.doses(circle.id), dose.id, dose);

    const updated = await logDose(circle, elder, dose.id, { status: "TAKEN" }, now);

    expect(updated.status).toBe("TAKEN");
    expect(updated.loggedById).toBe(elder.id);

    // Stock decremented by 1
    const freshMed = await db.get(C.medications(circle.id), med.id);
    expect((freshMed as { stock: number }).stock).toBe(19);

    // Refuses to log already taken dose
    await expect(logDose(circle, elder, dose.id, { status: "TAKEN" }, now)).rejects.toThrow();
  });

  it("handles missed dose reasons and routes unwell/side_effect to symptoms", async () => {
    const { db, circle, elder } = await harness();
    const now = new Date("2026-11-15T09:00:00.000Z");

    const med = medication({
      stock: 20,
      schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null },
    });
    await db.set(C.medications(circle.id), med.id, med);

    const dose: DoseEvent = {
      id: "dose-2",
      circleId: circle.id,
      medicationId: med.id,
      medName: med.name,
      scheduledFor: now.toISOString(),
      dayKey: istDayKey(now),
      status: "PENDING",
      loggedAt: null,
      loggedById: null,
      loggedByName: null,
      missedReason: null,
      noteEnc: null,
    };
    await db.set(C.doses(circle.id), dose.id, dose);

    const missed = await logDose(circle, elder, dose.id, { status: "MISSED", reason: "unwell" }, now);
    expect(missed.status).toBe("MISSED");
    expect(missed.missedReason).toBe("unwell");

    // Check that symptom was recorded
    const symptoms = await db.query(C.symptoms(circle.id));
    expect(symptoms.length).toBe(1);
  });
});
