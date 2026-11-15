import { startSession } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { joinCircle } from "@/lib/services/circles";
import { joinCircleSchema } from "@/lib/validation";

/** Join a circle with its code and a one-time invite passcode. */
export const POST = route({ public: true, body: joinCircleSchema, perMinute: 10 }, async ({ body }) => {
  const { member } = await joinCircle(body);
  await startSession(member);
  return { role: member.role };
});
