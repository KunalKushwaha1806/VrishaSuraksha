import { route } from "@/lib/http";
import { logDose } from "@/lib/services/doses";
import { logDoseSchema } from "@/lib/validation";

/** Log a dose as taken, skipped or missed (with a reason). Caretakers may log on the elder's behalf. */
export const POST = route({ permission: "doses:log", body: logDoseSchema, perMinute: 30 }, async ({ auth, body, params }) => {
  const dose = await logDose(auth.circle, auth.member, params.id, body);
  return { dose: { id: dose.id, status: dose.status, missedReason: dose.missedReason } };
});
