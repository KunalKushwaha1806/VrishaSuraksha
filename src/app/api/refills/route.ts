import { z } from "zod";
import { canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { claimRefill } from "@/lib/services/care";
import { getDb } from "@/lib/db";
import { C, type RefillClaim } from "@/lib/models";

const claimBodySchema = z.object({
  medicationId: z.string().min(1).max(64),
});

/**
 * Lists refill claims for the circle.
 */
export const GET = route({ permission: "refill:claim", perMinute: 60 }, async ({ auth }) => {
  if (!canSee(auth.member, "stock")) throw fail.forbidden("The elder has not shared medicine stock with you.");
  const db = await getDb();
  const claims = await db.query<RefillClaim>(C.refillClaims(auth.circle.id));
  return { claims };
});

/**
 * Claims a refill by body medicationId.
 */
export const POST = route(
  { permission: "refill:claim", body: claimBodySchema, perMinute: 30 },
  async ({ auth, body }) => {
    if (!canSee(auth.member, "stock")) throw fail.forbidden("The elder has not shared medicine stock with you.");
    const claim = await claimRefill(auth.circle.id, auth.member, body.medicationId);
    return { claim };
  },
);
