import { canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { addSymptomNote, listSymptoms } from "@/lib/services/care";
import { symptomSchema } from "@/lib/validation";

export const GET = route({ permission: "symptoms:read" }, async ({ auth }) => {
  if (!canSee(auth.member, "symptoms")) throw fail.forbidden("The elder has not shared health notes with you.");
  return { symptoms: await listSymptoms(auth.circle.id) };
});

export const POST = route({ permission: "symptoms:write", body: symptomSchema }, async ({ auth, body }) => {
  const entry = await addSymptomNote(auth.circle.id, auth.member, body);
  return { id: entry.id };
});
