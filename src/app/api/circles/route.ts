import { startSession } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { createCircle } from "@/lib/services/circles";
import { createCircleSchema } from "@/lib/validation";

/**
 * Returns current circle details for authenticated member.
 */
export const GET = route({ permission: "circle:read", perMinute: 60 }, async ({ auth }) => {
  return { circle: auth.circle };
});

/**
 * Creates a new care circle.
 */
export const POST = route({ public: true, body: createCircleSchema, perMinute: 5 }, async ({ body }) => {
  const { circle, member } = await createCircle(body);
  await startSession(member);
  return { circleCode: circle.code, role: member.role, circleId: circle.id };
});
