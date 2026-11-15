import { route } from "@/lib/http";
import { getMedication, medicationView, stopMedication, updateMedication } from "@/lib/services/medications";
import { medicationUpdateSchema } from "@/lib/validation";

export const GET = route({ permission: "meds:write" }, async ({ auth, params }) => ({
  medication: medicationView(await getMedication(auth.circle.id, params.id), true),
}));

export const PATCH = route({ permission: "meds:write", body: medicationUpdateSchema }, async ({ auth, body, params }) => ({
  medication: medicationView(await updateMedication(auth.circle.id, auth.member, params.id, body), true),
}));

/** Stops a medicine: history is kept, future reminders are removed. */
export const DELETE = route({ permission: "meds:write" }, async ({ auth, params }) => {
  await stopMedication(auth.circle.id, auth.member, params.id);
  return { ok: true };
});
