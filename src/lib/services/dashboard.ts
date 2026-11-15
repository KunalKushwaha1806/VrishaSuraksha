import type { AuthContext } from "../auth/session";
import { memo } from "../cache";
import { getDb } from "../db";
import { adherence, adherenceByMedication, streak, weekSummary } from "../domain/adherence";
import { can, visibilityOf } from "../domain/permissions";
import { forecastRefill } from "../domain/refill";
import { features } from "../env";
import { C, type Appointment, type DoseEvent, type Job, type Medication, type Member, type Reaction, type RefillClaim, type VoiceNote } from "../models";
import { addDays, istDayKey } from "../time";

const HISTORY_DAYS = 30;

async function loadCircle(circleId: string, now: Date) {
  const db = await getDb();
  const since = addDays(istDayKey(now), -HISTORY_DAYS);
  const [members, meds, doses, appointments, reactions, claims, voice, failed] = await Promise.all([
    db.query<Member>(C.members(circleId)),
    db.query<Medication>(C.medications(circleId), { where: [["active", "==", true]] }),
    db.query<DoseEvent>(C.doses(circleId), { where: [["dayKey", ">=", since]] }),
    db.query<Appointment>(C.appointments(circleId), { where: [["startsAt", ">=", now.toISOString()]], orderBy: { field: "startsAt" }, limit: 5 }),
    db.query<Reaction>(C.reactions(circleId), { orderBy: { field: "createdAt", direction: "desc" }, limit: 8 }),
    db.query<RefillClaim>(C.refillClaims(circleId)),
    db.query<VoiceNote>(C.voiceNotes(circleId), { orderBy: { field: "createdAt", direction: "desc" }, limit: 10 }),
    db.query<Job>(C.jobs, { where: [["status", "==", "failed"]], limit: 100 }),
  ]);
  return {
    members,
    meds,
    doses,
    appointments,
    reactions,
    claims: claims.filter((c) => !c.resolvedAt),
    voice: voice.map(({ audioEnc, ...meta }) => meta),
    failedJobs: failed.filter((j) => j.circleId === circleId).length,
  };
}

export type Dashboard = Awaited<ReturnType<typeof buildDashboard>>;

/** One payload per screen, filtered by role and by what the elder allows this member to see. */
export async function buildDashboard({ member, circle }: AuthContext, now = new Date()) {
  const data = await memo(`${circle.id}:dashboard`, 15_000, () => loadCircle(circle.id, now));
  const vis = visibilityOf(member);
  const today = istDayKey(now);
  const elder = data.members.find((m) => m.id === circle.elderMemberId);
  const medById = new Map(data.meds.map((m) => [m.id, m]));
  const isManager = member.role !== "FAMILY";

  const todayDoses = data.doses
    .filter((d) => d.dayKey === today)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .map((d) => ({
      id: d.id,
      medicationId: d.medicationId,
      medName: d.medName,
      doseText: medById.get(d.medicationId)?.doseText ?? "",
      scheduledFor: d.scheduledFor,
      status: d.status,
      missedReason: vis.missedReasons ? d.missedReason : null,
      loggedByName: d.loggedByName,
    }));

  const past = data.doses.filter((d) => d.dayKey <= today);
  const weekDoses = past.filter((d) => d.dayKey > addDays(today, -7));
  const byMed = adherenceByMedication(weekDoses, now);

  const refills = data.meds
    .map((m) => ({ med: m, f: forecastRefill(m.stock, m.unitsPerDose, m.schedule, now) }))
    .filter(({ f }) => f.needsRefill)
    .map(({ med, f }) => {
      const claim = data.claims.find((c) => c.medicationId === med.id);
      return { medicationId: med.id, name: med.name, stock: med.stock, daysLeft: f.daysLeft, runOutDay: f.runOutDay, claimedByName: claim?.claimedByName ?? null };
    });

  const recentMissed = isManager
    ? data.doses
        .filter((d) => d.status === "MISSED" && d.dayKey >= addDays(today, -2))
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
        .map((d) => ({ id: d.id, medName: d.medName, scheduledFor: d.scheduledFor, missedReason: d.missedReason }))
    : [];

  return {
    now: now.toISOString(),
    me: { id: member.id, name: member.name, role: member.role, language: member.language },
    circle: { name: circle.name, code: isManager ? circle.code : null },
    elder: { name: elder?.name ?? "", language: elder?.language ?? "en" },
    visibility: vis,
    features: { ai: features.ai(), tts: features.tts() },
    streak: streak(past, now),
    week: vis.doses ? weekSummary(past, now).map(({ day, scheduled, percent }) => ({ day, scheduled, percent })) : [],
    today: vis.doses ? todayDoses : [],
    adherence: vis.doses
      ? {
          today: adherence(past.filter((d) => d.dayKey === today), now),
          week: adherence(weekDoses, now),
          month: adherence(past, now),
          byMedication: data.meds.map((m) => ({ medicationId: m.id, name: m.name, percent: byMed[m.id]?.percent ?? null })),
        }
      : null,
    medications: data.meds
      .map((m) => ({
        id: m.id,
        name: m.name,
        doseText: m.doseText,
        form: m.form,
        criticality: m.criticality,
        times: m.schedule.times,
        days: m.schedule.days,
        stock: vis.stock ? m.stock : null,
        daysLeft: vis.stock ? forecastRefill(m.stock, m.unitsPerDose, m.schedule, now).daysLeft : null,
        hasExplanation: Boolean(m.explanations?.en || m.explanations?.hi),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    refills: vis.stock ? refills : [],
    appointments: vis.appointments
      ? data.appointments.map((a) => ({ id: a.id, doctor: a.doctor, place: a.place, startsAt: a.startsAt }))
      : [],
    reactions: data.reactions,
    voiceNotes: can(member.role, "voice:listen")
      ? data.voice
      : data.voice.filter((v) => v.fromMemberId === member.id),
    recentMissed,
    failedJobs: isManager ? data.failedJobs : 0,
  };
}
