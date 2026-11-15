import type { z } from "zod";
import { logActivity } from "../activity";
import { invalidateCircle } from "../cache";
import { decryptText, encryptText, newId } from "../crypto";
import { getDb } from "../db";
import { fail } from "../http";
import { C, type Medication, type Member, type RefillClaim } from "../models";
import type { medicationSchema, medicationUpdateSchema } from "../validation";
import { resyncMedication } from "./engine";

type MedicationInput = z.infer<typeof medicationSchema>;
type MedicationUpdate = z.infer<typeof medicationUpdateSchema>;

/** Client-safe view: notes decrypted only for members allowed to manage care. */
export function medicationView(med: Medication, includeNotes: boolean) {
  const { notesEnc, ...rest } = med;
  return { ...rest, notes: includeNotes ? decryptText(notesEnc) : null };
}

export async function listMedications(circleId: string, includeInactive = false): Promise<Medication[]> {
  const db = await getDb();
  const meds = await db.query<Medication>(C.medications(circleId));
  return meds.filter((m) => includeInactive || m.active).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMedication(circleId: string, id: string): Promise<Medication> {
  const db = await getDb();
  const med = await db.get<Medication>(C.medications(circleId), id);
  if (!med) throw fail.notFound("Medicine not found.");
  return med;
}

export async function createMedication(circleId: string, actor: Member, input: MedicationInput): Promise<Medication> {
  const db = await getDb();
  const now = new Date().toISOString();
  const { notes, ...fields } = input;
  const med: Medication = {
    ...fields,
    id: newId(),
    circleId,
    notesEnc: encryptText(notes),
    active: true,
    explanations: {},
    createdAt: now,
    updatedAt: now,
  };
  await db.set(C.medications(circleId), med.id, med);
  await resyncMedication(db, med);
  await logActivity(circleId, actor, `added medicine ${med.name}`, "medication", med.id);
  return med;
}

export async function updateMedication(
  circleId: string,
  actor: Member,
  id: string,
  input: MedicationUpdate,
): Promise<Medication> {
  const db = await getDb();
  const existing = await getMedication(circleId, id);
  const { notes, ...fields } = input;
  const patch: Record<string, unknown> = { ...fields, updatedAt: new Date().toISOString() };
  if (notes !== undefined) patch.notesEnc = encryptText(notes);
  if (fields.name && fields.name !== existing.name) patch.explanations = {};
  await db.update(C.medications(circleId), id, patch);
  const updated = await getMedication(circleId, id);

  if (fields.stock !== undefined && fields.stock > existing.stock) {
    const claim = await db.get<RefillClaim>(C.refillClaims(circleId), id);
    if (claim && !claim.resolvedAt)
      await db.update(C.refillClaims(circleId), id, { resolvedAt: new Date().toISOString() });
  }
  if (fields.schedule || fields.criticality || fields.name) await resyncMedication(db, updated);
  await logActivity(circleId, actor, `updated medicine ${updated.name}`, "medication", id);
  invalidateCircle(circleId);
  return updated;
}

/** Stopping a medicine keeps its history but removes future reminders. */
export async function stopMedication(circleId: string, actor: Member, id: string): Promise<void> {
  const db = await getDb();
  const med = await getMedication(circleId, id);
  await db.update(C.medications(circleId), id, { active: false, updatedAt: new Date().toISOString() });
  await resyncMedication(db, { ...med, active: false });
  await logActivity(circleId, actor, `stopped medicine ${med.name}`, "medication", id);
}
