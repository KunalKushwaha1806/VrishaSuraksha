import { startSession } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { createCircle } from "@/lib/services/circles";
import { createCircleSchema } from "@/lib/validation";

/** The elder (or someone helping them set up) creates a new care circle. */
export const POST = route({ public: true, body: createCircleSchema, perMinute: 5 }, async ({ body }) => {
  const { circle, member } = await createCircle(body);
  await startSession(member);
  return { circleCode: circle.code, role: member.role };
});
