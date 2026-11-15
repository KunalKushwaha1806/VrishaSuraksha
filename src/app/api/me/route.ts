import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { C } from "@/lib/models";
import { languageSchema } from "@/lib/validation";
import { invalidateCircle } from "@/lib/cache";

/** Any member can change their own language. */
export const PATCH = route({ permission: "circle:read", body: languageSchema }, async ({ auth, body }) => {
  const db = await getDb();
  await db.update(C.members(auth.circle.id), auth.member.id, { language: body.language });
  invalidateCircle(auth.circle.id);
  return { ok: true };
});
