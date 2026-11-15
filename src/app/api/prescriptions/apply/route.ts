import { logActivity } from "@/lib/activity";
import { route } from "@/lib/http";
import { createMedication, getMedication, stopMedication, updateMedication } from "@/lib/services/medications";
import { addDays, istDayKey } from "@/lib/time";
import { prescriptionApplySchema } from "@/lib/validation";

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Applies only the prescription changes a person reviewed and confirmed. */
export const POST = route({ permission: "meds:write", body: prescriptionApplySchema }, async ({ auth, body }) => {
  const today = istDayKey(new Date());
  let applied = 0;
  for (const item of body.items) {
    if (item.kind === "added") {
      await createMedication(auth.circle.id, auth.member, {
        name: item.name,
        doseText: item.doseText,
        form: "tablet",
        criticality: "normal",
        stock: item.stock,
        unitsPerDose: 1,
        notes: undefined,
        schedule: {
          times: item.times,
          days: EVERY_DAY,
          startDate: today,
          endDate: item.durationDays ? addDays(today, item.durationDays - 1) : null,
        },
      });
    } else if (item.kind === "changed") {
      const med = await getMedication(auth.circle.id, item.medicationId);
      await updateMedication(auth.circle.id, auth.member, med.id, {
        doseText: item.doseText,
        schedule: { ...med.schedule, times: item.times },
      });
    } else {
      await stopMedication(auth.circle.id, auth.member, item.medicationId);
    }
    applied++;
  }
  await logActivity(auth.circle.id, auth.member, `applied ${applied} confirmed prescription change(s)`, "prescription");
  return { applied };
});
