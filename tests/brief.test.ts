import { describe, expect, it } from "vitest";
import { harness, medication } from "./helpers";
import { C, type DoseEvent } from "@/lib/models";
import { buildBrief } from "@/lib/services/brief";
import { saveAppointment } from "@/lib/services/care";
import { istDayKey } from "@/lib/time";

describe("Doctor Brief Generator", () => {
  it("compiles a comprehensive clinical summary", async () => {
    const { db, circle, elder, caretaker } = await harness();
    const now = new Date("2026-11-15T12:00:00.000Z");

    // Add a scheduled appointment
    const appt = await saveAppointment(circle.id, caretaker, {
      doctor: "Dr. K. Mehta",
      place: "Cardiology OPD",
      startsAt: "2026-11-18T10:00:00.000Z",
      notes: "Review BP log and Metformin tolerance",
      reminderOffsetsMin: [60],
    });

    // Add a medication
    const med = medication({
      name: "Metformin",
      doseText: "500 mg",
      schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null },
    });
    await db.set(C.medications(circle.id), med.id, med);

    // Add some doses
    const dose1: DoseEvent = {
      id: "d1",
      circleId: circle.id,
      medicationId: med.id,
      medName: med.name,
      scheduledFor: "2026-11-14T03:30:00.000Z",
      dayKey: istDayKey(new Date("2026-11-14T03:30:00.000Z")),
      status: "TAKEN",
      loggedAt: "2026-11-14T03:35:00.000Z",
      loggedById: elder.id,
      loggedByName: elder.name,
      missedReason: null,
      noteEnc: null,
    };
    await db.set(C.doses(circle.id), dose1.id, dose1);

    const brief = await buildBrief(circle, appt.id, now);

    expect(brief.elderName).toBe(elder.name);
    expect(brief.appointment).toBeDefined();
    expect(brief.appointment?.doctor).toBe("Dr. K. Mehta");
    expect(brief.appointment?.notes).toBe("Review BP log and Metformin tolerance");
    expect(brief.medications.length).toBe(1);
    expect(brief.medications[0].name).toBe("Metformin");
    expect(brief.overall).toBeDefined();
    expect(brief.overall.percent).not.toBeNull();
  });
});
