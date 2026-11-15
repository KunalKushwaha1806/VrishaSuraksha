import { canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { claimRefill } from "@/lib/services/care";

/** "I'll handle it": claim a refill so everyone else sees it is covered. */
export const POST = route({ permission: "refill:claim" }, async ({ auth, params }) => {
  if (!canSee(auth.member, "stock")) throw fail.forbidden("The elder has not shared medicine stock with you.");
  const claim = await claimRefill(auth.circle.id, auth.member, params.medicationId);
  return { claim };
});
