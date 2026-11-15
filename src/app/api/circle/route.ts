import { logActivity } from "@/lib/activity";
import { endSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fail, route } from "@/lib/http";
import { C } from "@/lib/models";
import { deleteCircle } from "@/lib/services/circles";
import { deleteCircleSchema, emergencyContactsSchema } from "@/lib/validation";

/** Elder-only: update emergency contacts shown on the emergency card. */
export const PATCH = route({ permission: "share:manage", body: emergencyContactsSchema }, async ({ auth, body }) => {
  const db = await getDb();
  await db.update(C.circles, auth.circle.id, { emergencyContacts: body.emergencyContacts });
  await logActivity(auth.circle.id, auth.member, "updated emergency contacts", "circle", auth.circle.id);
  return { ok: true };
});

/** Elder-only: permanently delete the circle and all data. Requires typing the circle name. */
export const DELETE = route(
  { permission: "data:delete", body: deleteCircleSchema, perMinute: 3 },
  async ({ auth, body }) => {
    if (body.confirm !== auth.circle.name) throw fail.badRequest("Type the circle name exactly to confirm.");
    await deleteCircle(auth.circle);
    await endSession();
    return { ok: true };
  },
);
