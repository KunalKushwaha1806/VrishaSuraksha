import { NextResponse } from "next/server";
import { synthesize } from "@/lib/ai/tts";
import { fail, route } from "@/lib/http";
import { getMedication } from "@/lib/services/medications";
import { explainSchema } from "@/lib/validation";

export const maxDuration = 30;

/**
 * Speaks a medicine's cached explanation with Google Cloud Text-to-Speech.
 * It only ever speaks text the server generated, so it cannot be used as an
 * open text-to-speech proxy.
 */
export const POST = route({ permission: "explain:use", body: explainSchema, perMinute: 10 }, async ({ auth, body }) => {
  const med = await getMedication(auth.circle.id, body.medicationId);
  const text = med.explanations?.[body.language];
  if (!text) throw fail.badRequest("Ask what the medicine is for first.");
  const audio = await synthesize(text, body.language);
  return new NextResponse(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
});
