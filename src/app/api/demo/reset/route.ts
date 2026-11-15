import { endSession } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { fail, route } from "@/lib/http";
import { resetDemo } from "@/lib/services/seed";

/** Restores the demo circle to its starting story. Only touches the demo circle. */
export const POST = route({ public: true, perMinute: 3 }, async () => {
  if (!features.demo()) throw fail.notFound();
  await resetDemo();
  await endSession();
  return { ok: true };
});
