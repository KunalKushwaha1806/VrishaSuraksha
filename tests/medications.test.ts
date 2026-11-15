import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import {
  createMedication,
  getMedication,
  listMedications,
  medicationView,
  stopMedication,
  updateMedication,
} from "@/lib/services/medications";

describe("Medications Service", () => {
  it("creates, retrieves, and views medications", async () => {
    const { circle, caretaker } = await harness();

    const med = await createMedication(circle.id, caretaker, {
      name: "Atorvastatin",
      doseText: "10 mg",
      form: "tablet",
      criticality: "normal",
      stock: 45,
      unitsPerDose: 1,
      notes: "Take after dinner",
      schedule: {
        times: ["21:00"],
        days: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2026-01-01",
        endDate: null,
      },
    });

    expect(med.id).toBeDefined();
    expect(med.name).toBe("Atorvastatin");

    const fetched = await getMedication(circle.id, med.id);
    expect(fetched.stock).toBe(45);

    // View with notes authorized vs hidden
    const viewWithNotes = medicationView(med, true);
    expect(viewWithNotes.notes).toBe("Take after dinner");

    const viewWithoutNotes = medicationView(med, false);
    expect(viewWithoutNotes.notes).toBeNull();
  });

  it("updates medication details and stock", async () => {
    const { circle, caretaker } = await harness();

    const med = await createMedication(circle.id, caretaker, {
      name: "Metformin",
      doseText: "500 mg",
      form: "tablet",
      criticality: "normal",
      stock: 10,
      unitsPerDose: 1,
      notes: undefined,
      schedule: {
        times: ["08:00"],
        days: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2026-01-01",
        endDate: null,
      },
    });

    // Update stock and dosage
    const updatedMed = await updateMedication(circle.id, caretaker, med.id, {
      stock: 40,
      doseText: "1000 mg",
    });
    expect(updatedMed.stock).toBe(40);
    expect(updatedMed.doseText).toBe("1000 mg");
  });

  it("stops medications and filters active list", async () => {
    const { circle, caretaker } = await harness();

    const med = await createMedication(circle.id, caretaker, {
      name: "Temporary Cough Syrup",
      doseText: "10 ml",
      form: "syrup",
      criticality: "low",
      stock: 100,
      unitsPerDose: 10,
      notes: undefined,
      schedule: {
        times: ["14:00"],
        days: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2026-01-01",
        endDate: null,
      },
    });

    await stopMedication(circle.id, caretaker, med.id);
    const activeMeds = await listMedications(circle.id, false);
    expect(activeMeds.some((m) => m.id === med.id)).toBe(false);

    const allMeds = await listMedications(circle.id, true);
    expect(allMeds.some((m) => m.id === med.id)).toBe(true);
  });
});
