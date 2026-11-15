import { getDb } from "@/lib/db";
import { route } from "@/lib/http";
import { C, type ActivityEntry, type ConsentEntry } from "@/lib/models";

/** Elder-only: who viewed or changed what, plus the history of sharing changes. */
export const GET = route({ permission: "activity:read" }, async ({ auth }) => {
  const db = await getDb();
  const [activity, consent] = await Promise.all([
    db.query<ActivityEntry>(C.activity(auth.circle.id), { orderBy: { field: "at", direction: "desc" }, limit: 100 }),
    db.query<ConsentEntry>(C.consent(auth.circle.id), { orderBy: { field: "at", direction: "desc" }, limit: 50 }),
  ]);
  return { activity, consent };
});
