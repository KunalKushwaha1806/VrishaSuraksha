import { z } from "zod";
import { summariseForDoctor } from "@/lib/ai/gemini";
import { logActivity } from "@/lib/activity";
import { route } from "@/lib/http";
import { briefFacts, buildBrief } from "@/lib/services/brief";

export const maxDuration = 30;

/** Optional AI summary on top of the deterministic brief. Facts are anonymised first. */
export const POST = route(
  { permission: "brief:read", body: z.object({ appointmentId: z.string().max(64).nullable() }), perMinute: 5 },
  async ({ auth, body }) => {
    const brief = await buildBrief(auth.circle, body.appointmentId);
    const bullets = await summariseForDoctor(briefFacts(brief));
    await logActivity(auth.circle.id, auth.member, "generated an AI doctor brief summary", "brief");
    return { bullets };
  },
);
