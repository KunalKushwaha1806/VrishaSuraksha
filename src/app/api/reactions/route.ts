import { route } from "@/lib/http";
import { addReaction } from "@/lib/services/care";
import { reactionSchema } from "@/lib/validation";

/** Family sends a heart or a preset message. No free text: kind words only. */
export const POST = route({ permission: "reactions:send", body: reactionSchema, perMinute: 20 }, async ({ auth, body }) => ({
  reaction: await addReaction(auth.circle.id, auth.member, body.kind),
}));
