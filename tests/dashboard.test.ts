import { describe, expect, it } from "vitest";
import { harness, medication } from "./helpers";
import { C, type DoseEvent } from "@/lib/models";
import { buildDashboard } from "@/lib/services/dashboard";
import { istDayKey } from "@/lib/time";

describe("Dashboard Service", () => {
  it("builds a full dashboard for the elder with streak and upcoming doses", async () => {
    const { db, circle, elder } = await harness();
    const now = new Date("2026-11-15T09:00:00.000Z");
    const today = istDayKey(now);

    const med = medication({
      stock: 2,
      schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null },
    });
    await db.set(C.medications(circle.id), med.id, med);

    const dose: DoseEvent = {
      id: "dose-dash-1",
      circleId: circle.id,
      medicationId: med.id,
      medName: med.name,
      dayKey: today,
      scheduledFor: now.toISOString(),
      status: "PENDING",
      loggedById: null,
      loggedByName: null,
      loggedAt: null,
      missedReason: null,
      noteEnc: null,
    };
    await db.set(C.doses(circle.id), dose.id, dose);

    const dashboard = await buildDashboard({ member: elder, circle }, now);

    expect(dashboard.elder.name).toBe(elder.name);
    expect(dashboard.me.role).toBe("ELDER");
    expect(dashboard.today.length).toBe(1);
    expect(dashboard.today[0].medName).toBe("Metformin");
    expect(dashboard.medications.length).toBe(1);
    expect(dashboard.refills.length).toBe(1); // Low stock flags refill
  });

  it("masks private details for restricted family members", async () => {
    const { circle, family } = await harness();
    const now = new Date("2026-11-15T09:00:00.000Z");

    // Family member with hidden missed reasons & hidden stock
    const restrictedFamily = {
      ...family,
      visibility: {
        doses: true,
        missedReasons: false,
        symptoms: false,
        appointments: false,
        stock: false,
      },
    };

    const dashboard = await buildDashboard({ member: restrictedFamily, circle }, now);

    expect(dashboard.visibility.missedReasons).toBe(false);
    expect(dashboard.visibility.stock).toBe(false);
    expect(dashboard.refills.length).toBe(0); // Hidden
    expect(dashboard.appointments.length).toBe(0); // Hidden
  });

  it("provides caretaker view with circle join codes and manager tools", async () => {
    const { circle, caretaker } = await harness();
    const now = new Date("2026-11-15T09:00:00.000Z");

    const dashboard = await buildDashboard({ member: caretaker, circle }, now);

    expect(dashboard.me.role).toBe("CARETAKER");
    expect(dashboard.circle.code).toBe(circle.code); // Caretaker sees circle invite code
  });
});
