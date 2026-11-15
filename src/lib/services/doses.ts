import { logActivity } from "../activity";
import { invalidateCircle } from "../cache";
import { encryptText, newId } from "../crypto";
import { getDb } from "../db";
import { findDoubleDose } from "../domain/doubleDose";
import { fail } from "../http";
import {
  C,
  type Circle,
  type DoseEvent,
  type DoseStatus,
  type Medication,
  type Member,
  type MissedReason,
  type SymptomEntry,
} from "../models";
import { addDays, formatTime, istDayKey } from "../time";
import { cancelJobs, notify, queueRefillAlert } from "./engine";

export interface LogDoseInput {
  status: Exclude<DoseStatus, "PENDING">;
  reason?: MissedReason;
  note?: string;
  confirmDouble?: boolean;
}

const REASON_TEXT: Record<MissedReason, string> = {
  forgot: "forgot",
  unwell: "felt unwell",
  side_effect: "reported a side effect",
  ran_out: "ran out of the medicine",
};

async function recentIntakes(circleId: string, med: Medication, excludeDoseId: string, now: Date): Promise<string[]> {
  const db = await getDb();
  const today = istDayKey(now);
  const doses = await db.query<DoseEvent>(C.doses(circleId), { where: [["dayKey", "in", [addDays(today, -1), today]]] });
  return doses
    .filter((d) => d.medicationId === med.id && d.id !== excludeDoseId && d.status === "TAKEN" && d.loggedAt)
    .map((d) => d.loggedAt as string);
}

async function addSymptom(circleId: string, actor: Member, kind: SymptomEntry["kind"], text: string, dose: DoseEvent) {
  const db = await getDb();
  const entry: SymptomEntry = {
    id: newId(),
    circleId,
    kind,
    textEnc: encryptText(text),
    medicationId: dose.medicationId,
    doseId: dose.id,
    createdById: actor.id,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.symptoms(circleId), entry.id, entry);
}

/** Each missed-dose reason triggers a different, proportionate response. */
async function triage(circle: Circle, actor: Member, elderName: string, dose: DoseEvent, med: Medication, reason: MissedReason, note?: string) {
  const db = await getDb();
  const when = formatTime(dose.scheduledFor);
  switch (reason) {
    case "forgot":
      return;
    case "unwell":
      await addSymptom(circle.id, actor, "unwell", note ?? `Felt unwell around ${when}; missed ${med.name}.`, dose);
      await notify(circle.id, {
        audience: "caretakers",
        subject: `${elderName} felt unwell and missed ${med.name}`,
        message: `${elderName} missed the ${when} dose of ${med.name} because they felt unwell. Please check in with them.`,
      });
      return;
    case "side_effect":
      await addSymptom(circle.id, actor, "side_effect", note ?? `Trouble with ${med.name}; dose at ${when} not taken.`, dose);
      await notify(circle.id, {
        audience: "caretakers",
        subject: `${elderName} reported trouble with ${med.name}`,
        message: `${elderName} skipped ${med.name} at ${when} because of a possible side effect. It has been added to the next doctor visit brief.`,
      });
      return;
    case "ran_out":
      await db.update(C.medications(circle.id), med.id, { stock: 0, updatedAt: new Date().toISOString() });
      await queueRefillAlert(db, { ...med, stock: 0 }, new Date(), true);
      return;
  }
}

/**
 * Logs a dose for the elder, or on their behalf by a caretaker.
 * Guards against double doses, keeps stock in step, cancels pending
 * reminders, and routes missed-dose reasons to the right people.
 */
export async function logDose(
  circle: Circle,
  actor: Member,
  doseId: string,
  input: LogDoseInput,
  now = new Date(),
): Promise<DoseEvent> {
  const db = await getDb();
  const dose = await db.get<DoseEvent>(C.doses(circle.id), doseId);
  if (!dose) throw fail.notFound("Dose not found.");
  const med = await db.get<Medication>(C.medications(circle.id), dose.medicationId);
  if (!med) throw fail.notFound("Medicine not found.");
  if (dose.status === "TAKEN") throw fail.conflict("This dose is already marked as taken.", { reason: "already_taken" });
  if (dose.scheduledFor > new Date(now.getTime() + 3 * 60 * 60_000).toISOString() && input.status === "TAKEN") {
    throw fail.badRequest("This dose is not due yet.");
  }

  let doubleDoseConfirmed = false;
  if (input.status === "TAKEN") {
    const conflictAt = findDoubleDose(await recentIntakes(circle.id, med, dose.id, now), now, med.schedule.times);
    if (conflictAt && !input.confirmDouble) {
      throw fail.conflict("This medicine was already taken a short while ago.", { reason: "double_dose", lastTakenAt: conflictAt });
    }
    doubleDoseConfirmed = Boolean(conflictAt);
  }

  const updated = await db.transaction(async (tx) => {
    // Firestore requires every read in a transaction to happen before any write.
    const fresh = await tx.get<DoseEvent>(C.doses(circle.id), doseId);
    const freshMed = await tx.get<Medication>(C.medications(circle.id), med.id);
    if (!fresh || fresh.status === "TAKEN") throw fail.conflict("This dose was just logged by someone else.", { reason: "already_taken" });
    const patch: Partial<DoseEvent> = {
      status: input.status,
      loggedById: actor.id,
      loggedByName: actor.name,
      loggedAt: now.toISOString(),
      missedReason: input.status === "MISSED" ? (input.reason ?? null) : null,
      noteEnc: encryptText(input.note),
    };
    tx.update(C.doses(circle.id), doseId, patch);
    if (input.status === "TAKEN") {
      tx.update(C.medications(circle.id), med.id, {
        stock: Math.max(0, (freshMed?.stock ?? med.stock) - med.unitsPerDose),
      });
    }
    return { ...fresh, ...patch } as DoseEvent;
  });

  await cancelJobs(db, "doseId", doseId);
  invalidateCircle(circle.id);

  const elder = actor.id === circle.elderMemberId ? actor : await db.get<Member>(C.members(circle.id), circle.elderMemberId);
  const elderName = elder?.name ?? "The elder";
  const onBehalf = actor.id !== circle.elderMemberId ? ` on behalf of ${elderName}` : "";
  const verb = input.status === "TAKEN" ? "logged as taken" : input.status === "SKIPPED" ? "logged as skipped" : `logged as missed (${REASON_TEXT[input.reason ?? "forgot"]})`;
  await logActivity(circle.id, actor, `${med.name} ${formatTime(dose.scheduledFor)} ${verb}${onBehalf}`, "dose", doseId);

  if (doubleDoseConfirmed) {
    await notify(circle.id, {
      audience: "caretakers",
      subject: `Possible double dose of ${med.name}`,
      message: `${med.name} was logged as taken twice within a short time (${actor.name} confirmed it). Please check on ${elderName}.`,
    });
  }
  if (input.status === "MISSED" && input.reason) {
    await triage(circle, actor, elderName, dose, med, input.reason, input.note);
  }
  return updated;
}
