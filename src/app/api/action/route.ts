import { consumeActionToken, verifyActionToken } from "@/lib/actionTokens";
import { getDb } from "@/lib/db";
import { can, canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { C, type Circle, type Member } from "@/lib/models";
import { claimRefill } from "@/lib/services/care";
import { logDose } from "@/lib/services/doses";
import { actionSchema } from "@/lib/validation";

/**
 * Performs the single action an email link was issued for. Opening the link
 * (GET) never changes anything, so email scanners cannot trigger it; the
 * person must press a button, which POSTs here.
 */
export const POST = route({ public: true, body: actionSchema, perMinute: 20 }, async ({ body }) => {
  const claims = await verifyActionToken(body.token);
  if (!claims) throw fail.unauthorized("This link has expired. Please open the app instead.");

  const db = await getDb();
  const [member, circle] = await Promise.all([
    db.get<Member>(C.members(claims.circleId), claims.memberId),
    db.get<Circle>(C.circles, claims.circleId),
  ]);
  if (!member || !member.active || !circle) throw fail.forbidden("This link is no longer valid.");

  const allowed =
    claims.kind === "dose"
      ? can(member.role, "doses:log") && body.choice !== "claim"
      : can(member.role, "refill:claim") && canSee(member, "stock") && body.choice === "claim";
  if (!allowed) throw fail.forbidden("This link cannot do that.");
  if (!(await consumeActionToken(claims.jti))) throw fail.conflict("This link was already used.");

  if (claims.kind === "refill") {
    await claimRefill(circle.id, member, claims.ref);
    return { done: "claimed" };
  }
  if (body.choice === "taken") {
    await logDose(circle, member, claims.ref, { status: "TAKEN" });
    return { done: "taken" };
  }
  await logDose(circle, member, claims.ref, { status: "MISSED", reason: body.choice as "forgot" | "unwell" | "side_effect" | "ran_out" });
  return { done: "reason" };
});
