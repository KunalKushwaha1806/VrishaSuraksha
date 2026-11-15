import { extractPrescription } from "@/lib/ai/gemini";
import { logActivity } from "@/lib/activity";
import { diffPrescription } from "@/lib/domain/prescription";
import { route } from "@/lib/http";
import { listMedications } from "@/lib/services/medications";
import { prescriptionScanSchema } from "@/lib/validation";

export const maxDuration = 30;

/**
 * Reads a prescription photo with Gemini and returns a diff against the
 * current schedule. The image is processed in memory and never stored.
 * Nothing is applied here: a person must confirm the diff first.
 */
export const POST = route(
  { permission: "prescription:scan", body: prescriptionScanSchema, maxBytes: 2_200_000, perMinute: 6 },
  async ({ auth, body }) => {
    const extracted = await extractPrescription(body.imageBase64, body.mimeType);
    const current = await listMedications(auth.circle.id);
    const diff = diffPrescription(
      current.map((m) => ({ id: m.id, name: m.name, doseText: m.doseText, times: m.schedule.times })),
      extracted,
    );
    await logActivity(auth.circle.id, auth.member, "scanned a prescription", "prescription");
    return { extracted, diff };
  },
);
