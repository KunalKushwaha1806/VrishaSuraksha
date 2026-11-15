import { startSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { features } from "@/lib/env";
import { fail, route } from "@/lib/http";
import { C, type Member } from "@/lib/models";
import { DEMO_CIRCLE_ID, DEMO_MEMBERS, ensureDemo } from "@/lib/services/seed";
import { demoLoginSchema } from "@/lib/validation";

/** One-click sign-in to the fictional demo circle. Disabled unless DEMO_MODE=true. */
export const POST = route({ public: true, body: demoLoginSchema, perMinute: 20 }, async ({ body }) => {
  if (!features.demo()) throw fail.notFound();
  await ensureDemo();
  const id =
    body.role === "ELDER" ? DEMO_MEMBERS.elder : body.role === "CARETAKER" ? DEMO_MEMBERS.caretaker : DEMO_MEMBERS[body.member ?? "riya"];
  const db = await getDb();
  const member = await db.get<Member>(C.members(DEMO_CIRCLE_ID), id);
  if (!member || !member.active) throw fail.conflict("This demo member was revoked. Reset the demo to start again.");
  await startSession(member);
  return { role: member.role };
});
