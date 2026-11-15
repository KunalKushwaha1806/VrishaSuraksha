import { route } from "@/lib/http";
import { publicMember, updateMember } from "@/lib/services/circles";
import { memberUpdateSchema } from "@/lib/validation";

/** Elder-only: set what a family member can see, or revoke someone's access immediately. */
export const PATCH = route(
  { permission: "privacy:manage", body: memberUpdateSchema },
  async ({ auth, body, params }) => {
    const updated = await updateMember(auth.circle, auth.member, params.id, body);
    return { member: publicMember(updated) };
  },
);
