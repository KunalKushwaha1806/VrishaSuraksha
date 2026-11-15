import { z } from "zod";
import { canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { claimRefill } from "@/lib/services/care";

const claimBodySchema = z.object({
  medicationId: z.string().min(1).max(64),
});

/** "I'll handle it": claim a refill so everyone else sees it is covered. */
export const POST = route(
  { permission: "refill:claim", body: claimBodySchema, perMinute: 30 },
  async ({ auth, body }) => {
    if (!canSee(auth.member, "stock")) throw fail.forbidden("The elder has not shared medicine stock with you.");
    const claim = await claimRefill(auth.circle.id, auth.member, body.medicationId);
    return { claim };
  },
);
