import { logActivity } from "@/lib/activity";
import { startSession } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { login } from "@/lib/services/circles";
import { loginSchema } from "@/lib/validation";

export const POST = route({ public: true, body: loginSchema, perMinute: 10 }, async ({ body }) => {
  const member = await login(body);
  await startSession(member);
  await logActivity(member.circleId, member, "signed in", "session");
  return { role: member.role };
});
