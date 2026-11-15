import { explainMedicine } from "@/lib/ai/gemini";
import { invalidateCircle } from "@/lib/cache";
import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { C } from "@/lib/models";
import { getMedication } from "@/lib/services/medications";
import { explainSchema } from "@/lib/validation";

export const maxDuration = 30;

/**
 * Plain-language "what is this medicine for?". Only medicines already on the
 * elder's list can be explained. Answers are cached per language.
 */
export const POST = route({ permission: "explain:use", body: explainSchema, perMinute: 10 }, async ({ auth, body }) => {
  const med = await getMedication(auth.circle.id, body.medicationId);
  const cached = med.explanations?.[body.language];
  if (cached) return { text: cached, cached: true };
  const text = await explainMedicine(med.name, body.language);
  const db = await getDb();
  await db.update(C.medications(auth.circle.id), med.id, { explanations: { ...med.explanations, [body.language]: text } });
  invalidateCircle(auth.circle.id);
  return { text, cached: false };
});
