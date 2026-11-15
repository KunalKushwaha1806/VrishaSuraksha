import { decryptText } from "../crypto";
import { getDb } from "../db";
import { adherence, adherenceByMedication } from "../domain/adherence";
import { C, type Appointment, type Circle, type DoseEvent, type Medication, type MissedReason, type SymptomEntry } from "../models";
import { addDays, formatDate, formatDateTime, istDayKey } from "../time";

const PERIOD_DAYS = 30;

const REASON_LABEL: Record<MissedReason, string> = {
  forgot: "forgot",
  unwell: "felt unwell",
  side_effect: "side effect reported",
  ran_out: "medicine ran out",
};

/** Deterministic one-page summary for the doctor. The AI summary is optional on top of this. */
export async function buildBrief(circle: Circle, appointmentId: string | null, now = new Date()) {
  const db = await getDb();
  const since = addDays(istDayKey(now), -PERIOD_DAYS);
  const [meds, doses, symptoms, appointment, elder] = await Promise.all([
    db.query<Medication>(C.medications(circle.id), { where: [["active", "==", true]] }),
    db.query<DoseEvent>(C.doses(circle.id), { where: [["dayKey", ">=", since]] }),
    db.query<SymptomEntry>(C.symptoms(circle.id), { orderBy: { field: "createdAt", direction: "desc" }, limit: 50 }),
    appointmentId ? db.get<Appointment>(C.appointments(circle.id), appointmentId) : Promise.resolve(null),
    db.get<{ name: string }>(C.members(circle.id), circle.elderMemberId),
  ]);
  const past = doses.filter((d) => d.scheduledFor <= now.toISOString());
  const overall = adherence(past, now);
  const byMed = adherenceByMedication(past, now);
  const sinceIso = new Date(now.getTime() - PERIOD_DAYS * 86_400_000).toISOString();

  return {
    generatedAt: now.toISOString(),
    periodLabel: `${formatDate(sinceIso)} to ${formatDate(now.toISOString())}`,
    elderName: elder?.name ?? "",
    appointment: appointment
      ? { doctor: appointment.doctor, place: appointment.place, when: formatDateTime(appointment.startsAt), notes: decryptText(appointment.notesEnc) }
      : null,
    overall,
    medications: meds
      .map((m) => ({
        name: m.name,
        doseText: m.doseText,
        times: m.schedule.times,
        adherence: byMed[m.id]?.percent ?? null,
        missed: byMed[m.id]?.missed ?? 0,
        notes: decryptText(m.notesEnc),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    missed: past
      .filter((d) => d.status === "MISSED")
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
      .slice(0, 15)
      .map((d) => ({ when: formatDateTime(d.scheduledFor), medName: d.medName, reason: d.missedReason ? REASON_LABEL[d.missedReason] : "no reason given" })),
    symptoms: symptoms
      .filter((s) => s.createdAt >= sinceIso)
      .map((s) => ({
        when: formatDateTime(s.createdAt),
        kind: s.kind,
        medName: meds.find((m) => m.id === s.medicationId)?.name ?? null,
        text: decryptText(s.textEnc) ?? "",
      })),
  };
}

export type Brief = Awaited<ReturnType<typeof buildBrief>>;

/** Removes emails, phone numbers and the elder's name from free text before it leaves the server. */
export function redact(text: string, names: string[]): string {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[phone]");
  for (const name of names.filter((n) => n.trim().length > 1)) {
    out = out.split(name).join("[the patient]");
  }
  return out;
}

/** Anonymised facts for the AI summary: medicine names and counts only, no personal identifiers. */
export function briefFacts(brief: Brief): string {
  const lines = [
    `Period: last ${PERIOD_DAYS} days. Overall adherence: ${brief.overall.percent ?? "n/a"}% (${brief.overall.taken} taken, ${brief.overall.missed} missed, ${brief.overall.skipped} skipped).`,
    ...brief.medications.map((m) => `Medicine ${m.name} ${m.doseText}: adherence ${m.adherence ?? "n/a"}%, missed ${m.missed}.`),
    ...brief.missed.map((m) => `Missed ${m.medName}: ${m.reason}.`),
    ...brief.symptoms.map((s) => `Reported (${s.kind.replace("_", " ")})${s.medName ? ` about ${s.medName}` : ""}: ${s.text.slice(0, 200)}`),
  ];
  return redact(lines.join("\n"), [brief.elderName]);
}
