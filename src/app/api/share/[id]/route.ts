import { route } from "@/lib/http";
import { revokeShareToken } from "@/lib/services/care";

export const DELETE = route({ permission: "share:manage" }, async ({ auth, params }) => {
  await revokeShareToken(auth.circle.id, auth.member, params.id);
  return { ok: true };
});
