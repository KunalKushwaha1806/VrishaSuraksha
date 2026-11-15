import { endSession } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const POST = route({ public: true }, async () => {
  await endSession();
  return { ok: true };
});
