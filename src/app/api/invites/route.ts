import { route } from "@/lib/http";
import { createInvite } from "@/lib/services/circles";
import { inviteSchema } from "@/lib/validation";

/** Elder or caretaker issues a one-time invite passcode (valid 48 hours, shown once). */
export const POST = route({ permission: "members:invite", body: inviteSchema, perMinute: 10 }, async ({ auth, body }) => {
  const invite = await createInvite(auth.circle, auth.member, body.role);
  return { ...invite, circleCode: auth.circle.code };
});
