import { route } from "@/lib/http";
import { getDb } from "@/lib/db";
import { C, type DoseEvent } from "@/lib/models";

/**
 * Returns doses for the authenticated circle.
 */
export const GET = route({ permission: "doses:read", perMinute: 60 }, async ({ auth }) => {
  const db = await getDb();
  const doses = await db.query<DoseEvent>(C.doses(auth.circle.id));
  return { doses };
});
