import type { z } from "zod";
import { logActivity } from "../activity";
import { invalidateCircle } from "../cache";
import { decryptBytes, decryptText, encryptBytes, encryptText, newId, randomToken, sha256 } from "../crypto";
import { getDb } from "../db";
import { fail } from "../http";
import {
  C,
  type Appointment,
  type Circle,
  type Medication,
  type Member,
  type Reaction,
  type ReactionKind,
  type RefillClaim,
  type ShareToken,
  type SymptomEntry,
  type VoiceNote,
} from "../models";
import type { appointmentSchema, symptomSchema, voiceNoteSchema } from "../validation";
import { MAX_VOICE_BYTES } from "../validation";
import { cancelJobs, scheduleAppointmentJobs } from "./engine";

/* ---------- Appointments ---------- */

type AppointmentInput = z.infer<typeof appointmentSchema>;

export function appointmentView(a: Appointment) {
  const { notesEnc, ...rest } = a;
  return { ...rest, notes: decryptText(notesEnc) };
}

export async function listAppointments(circleId: string, fromIso?: string): Promise<Appointment[]> {
  const db = await getDb();
  const all = await db.query<Appointment>(C.appointments(circleId), { orderBy: { field: "startsAt" } });
  return fromIso ? all.filter((a) => a.startsAt >= fromIso) : all;
}

export async function saveAppointment(
  circleId: string,
  actor: Member,
  input: AppointmentInput,
  id?: string,
): Promise<Appointment> {
  const db = await getDb();
  const existing = id ? await db.get<Appointment>(C.appointments(circleId), id) : null;
  if (id && !existing) throw fail.notFound("Appointment not found.");
  const appt: Appointment = {
    id: existing?.id ?? newId(),
    circleId,
    doctor: input.doctor,
    place: input.place,
    startsAt: new Date(input.startsAt).toISOString(),
    notesEnc: encryptText(input.notes),
    reminderOffsetsMin: input.reminderOffsetsMin,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await db.set(C.appointments(circleId), appt.id, appt);
  await scheduleAppointmentJobs(db, appt);
  await logActivity(
    circleId,
    actor,
    `${existing ? "updated" : "added"} a visit with ${appt.doctor}`,
    "appointment",
    appt.id,
  );
  invalidateCircle(circleId);
  return appt;
}

export async function deleteAppointment(circleId: string, actor: Member, id: string): Promise<void> {
  const db = await getDb();
  const appt = await db.get<Appointment>(C.appointments(circleId), id);
  if (!appt) throw fail.notFound("Appointment not found.");
  await cancelJobs(db, "appointmentId", id);
  await db.delete(C.appointments(circleId), id);
  await logActivity(circleId, actor, `removed the visit with ${appt.doctor}`, "appointment", id);
  invalidateCircle(circleId);
}

/* ---------- Symptom diary ---------- */

export async function addSymptomNote(
  circleId: string,
  actor: Member,
  input: z.infer<typeof symptomSchema>,
): Promise<SymptomEntry> {
  const db = await getDb();
  const entry: SymptomEntry = {
    id: newId(),
    circleId,
    kind: input.kind,
    textEnc: encryptText(input.text),
    medicationId: input.medicationId ?? null,
    doseId: null,
    createdById: actor.id,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.symptoms(circleId), entry.id, entry);
  await logActivity(circleId, actor, "added a health note", "symptom", entry.id);
  return entry;
}

export async function listSymptoms(circleId: string, sinceIso?: string) {
  const db = await getDb();
  const entries = await db.query<SymptomEntry>(C.symptoms(circleId), {
    orderBy: { field: "createdAt", direction: "desc" },
    limit: 100,
  });
  return entries
    .filter((e) => !sinceIso || e.createdAt >= sinceIso)
    .map(({ textEnc, ...e }) => ({ ...e, text: decryptText(textEnc) }));
}

/* ---------- Reactions ("streaks, not guilt") ---------- */

export async function addReaction(circleId: string, actor: Member, kind: ReactionKind): Promise<Reaction> {
  const db = await getDb();
  const reaction: Reaction = {
    id: newId(),
    fromMemberId: actor.id,
    fromName: actor.name,
    kind,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.reactions(circleId), reaction.id, reaction);
  invalidateCircle(circleId);
  return reaction;
}

export async function recentReactions(circleId: string, limit = 10): Promise<Reaction[]> {
  const db = await getDb();
  return db.query<Reaction>(C.reactions(circleId), { orderBy: { field: "createdAt", direction: "desc" }, limit });
}

/* ---------- Family voice reminders ---------- */

export async function saveVoiceNote(
  circleId: string,
  actor: Member,
  input: z.infer<typeof voiceNoteSchema>,
): Promise<VoiceNote> {
  const db = await getDb();
  const audio = Buffer.from(input.audioBase64, "base64");
  if (audio.length === 0 || audio.length > MAX_VOICE_BYTES)
    throw fail.tooLarge("Voice notes must be under 400 KB (about 15 seconds).");
  if (input.medicationId && !(await db.get<Medication>(C.medications(circleId), input.medicationId))) {
    throw fail.badRequest("Pick a medicine from the list.");
  }
  const note: VoiceNote = {
    id: newId(),
    circleId,
    fromMemberId: actor.id,
    fromName: actor.name,
    medicationId: input.medicationId,
    mimeType: input.mimeType,
    durationSec: Math.round(input.durationSec),
    audioEnc: encryptBytes(audio),
    createdAt: new Date().toISOString(),
    playedAt: null,
  };
  await db.set(C.voiceNotes(circleId), note.id, note);
  await logActivity(circleId, actor, "recorded a voice reminder", "voiceNote", note.id);
  invalidateCircle(circleId);
  return note;
}

export async function listVoiceNotes(circleId: string) {
  const db = await getDb();
  const notes = await db.query<VoiceNote>(C.voiceNotes(circleId), {
    orderBy: { field: "createdAt", direction: "desc" },
    limit: 20,
  });
  return notes.map(({ audioEnc, ...meta }) => meta);
}

export async function readVoiceNote(circleId: string, id: string): Promise<{ audio: Buffer; mimeType: string }> {
  const db = await getDb();
  const note = await db.get<VoiceNote>(C.voiceNotes(circleId), id);
  if (!note) throw fail.notFound("Voice note not found.");
  return { audio: decryptBytes(note.audioEnc), mimeType: note.mimeType };
}

export async function markVoiceNotePlayed(circleId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.update(C.voiceNotes(circleId), id, { playedAt: new Date().toISOString() });
}

export async function deleteVoiceNote(circleId: string, actor: Member, id: string): Promise<void> {
  const db = await getDb();
  const note = await db.get<VoiceNote>(C.voiceNotes(circleId), id);
  if (!note) throw fail.notFound("Voice note not found.");
  if (note.fromMemberId !== actor.id && actor.role !== "ELDER") throw fail.forbidden();
  await db.delete(C.voiceNotes(circleId), id);
  invalidateCircle(circleId);
}

/* ---------- Refill claims ---------- */

/** "I'll handle it": the first person to claim a refill owns it; everyone else sees it is covered. */
export async function claimRefill(circleId: string, actor: Member, medicationId: string): Promise<RefillClaim> {
  const db = await getDb();
  const med = await db.get<Medication>(C.medications(circleId), medicationId);
  if (!med) throw fail.notFound("Medicine not found.");
  const claim = await db.transaction(async (tx) => {
    const existing = await tx.get<RefillClaim>(C.refillClaims(circleId), medicationId);
    if (existing && !existing.resolvedAt) {
      throw fail.conflict(`${existing.claimedByName} is already handling this refill.`, {
        claimedByName: existing.claimedByName,
      });
    }
    const fresh: RefillClaim = {
      medicationId,
      claimedById: actor.id,
      claimedByName: actor.name,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    tx.set(C.refillClaims(circleId), medicationId, fresh);
    return fresh;
  });
  await logActivity(circleId, actor, `will handle the refill of ${med.name}`, "refill", medicationId);
  invalidateCircle(circleId);
  return claim;
}

export async function listOpenClaims(circleId: string): Promise<RefillClaim[]> {
  const db = await getDb();
  const claims = await db.query<RefillClaim>(C.refillClaims(circleId));
  return claims.filter((c) => !c.resolvedAt);
}

/* ---------- Emergency QR card ---------- */

export async function createShareToken(
  circle: Circle,
  actor: Member,
  hours: number,
): Promise<{ token: string; share: ShareToken }> {
  const db = await getDb();
  const token = randomToken(32);
  const share: ShareToken = {
    id: newId(),
    circleId: circle.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString(),
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.shareTokens(circle.id), share.id, share);
  await db.set(C.shareLookup, share.tokenHash, { circleId: circle.id, shareId: share.id });
  await logActivity(circle.id, actor, `created an emergency card link valid for ${hours} hours`, "share", share.id);
  return { token, share };
}

export async function listShareTokens(circleId: string): Promise<ShareToken[]> {
  const db = await getDb();
  const tokens = await db.query<ShareToken>(C.shareTokens(circleId), {
    orderBy: { field: "createdAt", direction: "desc" },
  });
  return tokens;
}

export async function revokeShareToken(circleId: string, actor: Member, shareId: string): Promise<void> {
  const db = await getDb();
  const share = await db.get<ShareToken>(C.shareTokens(circleId), shareId);
  if (!share) throw fail.notFound("Link not found.");
  await db.update(C.shareTokens(circleId), shareId, { revokedAt: new Date().toISOString() });
  await db.delete(C.shareLookup, share.tokenHash);
  await logActivity(circleId, actor, "revoked an emergency card link", "share", shareId);
}

/** Resolves a public emergency link. Returns null if unknown, expired or revoked. */
export async function resolveShareToken(token: string): Promise<{ circle: Circle; share: ShareToken } | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const db = await getDb();
  const ref = await db.get<{ circleId: string; shareId: string }>(C.shareLookup, sha256(token));
  if (!ref) return null;
  const [share, circle] = await Promise.all([
    db.get<ShareToken>(C.shareTokens(ref.circleId), ref.shareId),
    db.get<Circle>(C.circles, ref.circleId),
  ]);
  if (!share || !circle || share.revokedAt || share.expiresAt <= new Date().toISOString()) return null;
  return { circle, share };
}
