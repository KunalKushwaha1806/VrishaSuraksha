import { can, canSee } from "@/lib/domain/permissions";
import { forecastRefill } from "@/lib/domain/refill";
import { route } from "@/lib/http";
import { createMedication, listMedications, medicationView } from "@/lib/services/medications";
import { medicationSchema } from "@/lib/validation";

export const GET = route({ permission: "meds:read" }, async ({ auth }) => {
  const manager = can(auth.member.role, "meds:write");
  const showStock = canSee(auth.member, "stock");
  const now = new Date();
  const meds = await listMedications(auth.circle.id);
  return {
    medications: meds.map((m) => {
      const view = medicationView(m, manager);
      return {
        ...view,
        stock: showStock ? m.stock : null,
        forecast: showStock ? forecastRefill(m.stock, m.unitsPerDose, m.schedule, now) : null,
      };
    }),
  };
});

export const POST = route({ permission: "meds:write", body: medicationSchema }, async ({ auth, body }) => {
  const med = await createMedication(auth.circle.id, auth.member, body);
  return { medication: medicationView(med, true) };
});
