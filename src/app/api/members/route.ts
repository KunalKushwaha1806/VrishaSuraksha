import { route } from "@/lib/http";
import { listMembers, publicMember } from "@/lib/services/circles";

export const GET = route({ permission: "members:read" }, async ({ auth }) => {
  const members = await listMembers(auth.circle.id);
  const isElder = auth.member.role === "ELDER";
  return {
    elderMemberId: auth.circle.elderMemberId,
    members: members
      .filter((m) => m.active || isElder)
      .map((m) => {
        const view = publicMember(m);
        // Only the elder sees everyone's contact email and sharing settings.
        return isElder || m.id === auth.member.id ? view : { ...view, email: null, visibility: null };
      }),
  };
});
