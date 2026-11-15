import { actionUrl } from "../actionTokens";
import { invalidateCircle } from "../cache";
import { newId } from "../crypto";
import { getDb, type Db } from "../db";
import { planEscalation } from "../domain/escalation";
import { canSee } from "../domain/permissions";
import { forecastRefill } from "../domain/refill";
import { occurrencesBetween } from "../domain/schedule";
import { sendEmail } from "../email";
import { env } from "../env";
import { t } from "../i18n";
import { errorMessage, log } from "../logger";
import {
  C,
  type Appointment,
  type Circle,
  type DoseEvent,
  type Job,
  type JobKind,
  type Medication,
  type Member,
  type NotifyPayload,
  type RefillClaim,
} from "../models";
import { addMinutes, compactStamp, formatDateTime, formatTime, istDayKey } from "../time";
import { renderEmail, type EmailContent } from "./emailTemplates";

/**
 * Reminder and escalation engine. There are no long-running workers:
 * Cloud Scheduler calls /api/cron/tick every minute and this module
 * does the rest.
 *
 * Exactly-once delivery comes from three guarantees:
 * 1. Job ids are deterministic (dose + step), so a job can only exist once.
 * 2. A job is claimed inside a transaction before sending; a concurrent tick
 *    sees it as "sending" and skips it.
 * 3. Each recipient is recorded in `sentTo` as soon as they are emailed, so
 *    a retry after a partial failure never emails the same person twice.
 */

export const GENERATE_HORIZON_HOURS = 48;
const GENERATOR_INTERVAL_MIN = 30;
const LEASE_MIN = 2;
const MAX_ATTEMPTS = 3;
const BACKOFF_MIN = [1, 5, 15];
const TICK_BATCH = 25;

export const doseIdFor = (circleId: string, medicationId: string, at: Date) =>
  `${circleId}_${medicationId}_${compactStamp(at)}`;
const doseJobId = (doseId: string, kind: JobKind) => `${doseId}_${kind}`;

function newJob(partial: Pick<Job, "id" | "circleId" | "kind" | "dueAt"> & Partial<Job>): Job {
  const now = new Date().toISOString();
  return {
    status: "pending",
    attempts: 0,
    lastError: null,
    leaseUntil: null,
    doseId: null,
    appointmentId: null,
    medicationId: null,
    payload: null,
    sentTo: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/** Creates dose rows and their escalation jobs for one medication. Idempotent. */
export async function materializeDoses(
  db: Db,
  med: Medication,
  from: Date,
  to: Date,
  now: Date,
): Promise<number> {
  if (!med.active) return 0;
  let created = 0;
  await Promise.all(
    occurrencesBetween(med.schedule, from, to).map(async (occ) => {
      const id = doseIdFor(med.circleId, med.id, occ.at);
      const dose: DoseEvent = {
        id,
        circleId: med.circleId,
        medicationId: med.id,
        medName: med.name,
        dayKey: occ.dayKey,
        scheduledFor: occ.at.toISOString(),
        status: "PENDING",
        loggedById: null,
        loggedByName: null,
        loggedAt: null,
        missedReason: null,
        noteEnc: null,
      };
      if (!(await db.create(C.doses(med.circleId), id, dose))) return;
      created++;
      await Promise.all(
        planEscalation(med.criticality, occ.at, now).map((step) =>
          db.create(
            C.jobs,
            doseJobId(id, step.kind),
            newJob({
              id: doseJobId(id, step.kind),
              circleId: med.circleId,
              kind: step.kind,
              dueAt: step.dueAt.toISOString(),
              doseId: id,
              medicationId: med.id,
            }),
          ),
        ),
      );
    }),
  );
  return created;
}

/** Cancels every pending job matching a field, e.g. all steps of one dose. */
export async function cancelJobs(db: Db, field: "doseId" | "appointmentId", value: string): Promise<number> {
  const jobs = await db.query<Job>(C.jobs, { where: [[field, "==", value]] });
  const pending = jobs.filter((j) => j.status === "pending");
  await Promise.all(
    pending.map((j) => db.update(C.jobs, j.id, { status: "cancelled", updatedAt: new Date().toISOString() })),
  );
  return pending.length;
}

/** Rebuilds future doses after a schedule edit: drops untouched future rows, then regenerates. */
export async function resyncMedication(db: Db, med: Medication, now = new Date()): Promise<void> {
  const future = await db.query<DoseEvent>(C.doses(med.circleId), {
    where: [["medicationId", "==", med.id]],
  });
  await Promise.all(
    future
      .filter((d) => d.status === "PENDING" && d.scheduledFor > now.toISOString())
      .map(async (d) => {
        await cancelJobs(db, "doseId", d.id);
        await db.delete(C.doses(med.circleId), d.id);
      }),
  );
  await materializeDoses(db, med, now, addMinutes(now, GENERATE_HORIZON_HOURS * 60), now);
  invalidateCircle(med.circleId);
}

async function openRefillClaim(db: Db, circleId: string, medicationId: string): Promise<RefillClaim | null> {
  const claim = await db.get<RefillClaim>(C.refillClaims(circleId), medicationId);
  return claim && !claim.resolvedAt ? claim : null;
}

/**
 * Queues a refill alert. At most one routine alert per medicine per day; an
 * urgent "ran out" alert is only added if today's routine alert has already
 * gone out, so nobody receives two refill emails for the same news.
 */
export async function queueRefillAlert(db: Db, med: Medication, now: Date, urgent = false): Promise<boolean> {
  if (await openRefillClaim(db, med.circleId, med.id)) return false;
  const dailyId = `refill_${med.circleId}_${med.id}_${istDayKey(now)}`;
  const urgentId = `${dailyId}_ranout`;
  const job = (id: string) =>
    newJob({ id, circleId: med.circleId, kind: "refill", dueAt: now.toISOString(), medicationId: med.id });

  if (!urgent) {
    if (await db.get<Job>(C.jobs, urgentId)) return false;
    return db.create(C.jobs, dailyId, job(dailyId));
  }
  const daily = await db.get<Job>(C.jobs, dailyId);
  if (daily?.status === "pending" || daily?.status === "sending") return false;
  return db.create(C.jobs, daily ? urgentId : dailyId, job(daily ? urgentId : dailyId));
}

/** Creates the next 48 hours of doses and today's refill alerts for every circle. Idempotent. */
export async function generateUpcoming(now = new Date()): Promise<{ doses: number; refills: number }> {
  const db = await getDb();
  const circles = await db.query<Circle>(C.circles);
  const to = addMinutes(now, GENERATE_HORIZON_HOURS * 60);
  let doses = 0;
  let refills = 0;
  for (const circle of circles) {
    const meds = await db.query<Medication>(C.medications(circle.id), { where: [["active", "==", true]] });
    for (const med of meds) {
      doses += await materializeDoses(db, med, now, to, now);
      if (forecastRefill(med.stock, med.unitsPerDose, med.schedule, now).needsRefill) {
        if (await queueRefillAlert(db, med, now)) refills++;
      }
    }
    if (doses) invalidateCircle(circle.id);
  }
  return { doses, refills };
}

/** Runs the generator at most once per interval across all instances. */
async function maybeGenerate(now: Date): Promise<boolean> {
  const db = await getDb();
  const due = await db.transaction(async (tx) => {
    const state = await tx.get<{ lastRunAt: string }>(C.system, "generator");
    if (state && new Date(state.lastRunAt).getTime() > now.getTime() - GENERATOR_INTERVAL_MIN * 60_000) return false;
    tx.set(C.system, "generator", { lastRunAt: now.toISOString() });
    return true;
  });
  if (due) await generateUpcoming(now);
  return due;
}

/** Schedules reminder jobs for an appointment, replacing any earlier ones. */
export async function scheduleAppointmentJobs(db: Db, appt: Appointment, now = new Date()): Promise<void> {
  await cancelJobs(db, "appointmentId", appt.id);
  const startsAt = new Date(appt.startsAt);
  await Promise.all(
    appt.reminderOffsetsMin.map((offset) => {
      const dueAt = addMinutes(startsAt, -offset);
      if (dueAt <= now) return Promise.resolve(false);
      const id = `appt_${appt.id}_${offset}_${compactStamp(startsAt)}`;
      return db.create(
        C.jobs,
        id,
        newJob({ id, circleId: appt.circleId, kind: "appointment", dueAt: dueAt.toISOString(), appointmentId: appt.id }),
      );
    }),
  );
}

/** Queues (and immediately tries to deliver) a one-off notice to part of the circle. */
export async function notify(circleId: string, payload: NotifyPayload, now = new Date()): Promise<void> {
  const db = await getDb();
  const id = `notify_${newId()}`;
  await db.create(C.jobs, id, newJob({ id, circleId, kind: "notify", dueAt: now.toISOString(), payload }));
  await processJob(id, now).catch((err) => log.warn("Immediate notice delivery deferred to cron", { error: errorMessage(err) }));
}

function recipients(members: Member[], job: Job): Member[] {
  const active = members.filter((m) => m.active);
  const elder = active.filter((m) => m.role === "ELDER");
  const caretakers = active.filter((m) => m.role === "CARETAKER");
  const family = active.filter((m) => m.role === "FAMILY");
  switch (job.kind) {
    case "dose_due":
    case "elder_renudge":
    case "mark_missed":
      return elder;
    case "caretaker_alert":
      return caretakers;
    case "family_alert":
      return family.filter((m) => canSee(m, "doses"));
    case "appointment":
      return active.filter((m) => canSee(m, "appointments"));
    case "refill":
      return [...caretakers, ...family.filter((m) => canSee(m, "stock"))];
    case "notify": {
      const p = job.payload;
      if (!p) return [];
      const pool =
        p.audience === "elder" ? elder : p.audience === "caretakers" ? caretakers : p.audience === "family" ? family : active;
      return pool.filter((m) => !p.requires || canSee(m, p.requires));
    }
  }
}

interface JobContext {
  circle: Circle;
  elder: Member | undefined;
  dose: DoseEvent | null;
  med: Medication | null;
  appt: Appointment | null;
}

async function composeFor(job: Job, ctx: JobContext, member: Member): Promise<EmailContent | null> {
  const elderName = ctx.elder?.name ?? "your family member";
  const appUrl = env().APP_URL;
  const { dose, med, appt } = ctx;
  const lang = member.language;
  const d = t(lang);
  const doseLink = async (label: string) =>
    dose ? { label, url: await actionUrl({ kind: "dose", circleId: ctx.circle.id, memberId: member.id, ref: dose.id }) } : undefined;

  switch (job.kind) {
    case "dose_due":
    case "elder_renudge": {
      if (!dose) return null;
      const time = formatTime(dose.scheduledFor);
      const again = job.kind === "elder_renudge";
      return {
        to: member.email,
        lang,
        subject: lang === "hi" ? `दवा का समय: ${dose.medName}` : `${again ? "Reminder: " : ""}Time for ${dose.medName}`,
        heading: lang === "hi" ? `${d.greeting} ${member.name}, ${dose.medName} लेने का समय है` : `${d.greeting} ${member.name}, it's time for ${dose.medName}`,
        lines: [
          lang === "hi" ? `समय: ${time}` : `Scheduled for ${time}${med ? ` (${med.doseText})` : ""}.`,
          lang === "hi" ? "दवा लेने के बाद नीचे दबाइए।" : "Tap the button once you have taken it.",
        ],
        action: await doseLink(d.tookIt),
      };
    }
    case "mark_missed": {
      if (!dose) return null;
      return {
        to: member.email,
        lang,
        subject: lang === "hi" ? `${dose.medName} छूट गई?` : `Did you miss ${dose.medName}?`,
        heading: lang === "hi" ? `${dose.medName} की खुराक दर्ज नहीं हुई` : `${dose.medName} at ${formatTime(dose.scheduledFor)} was not logged`,
        lines: [lang === "hi" ? "बताइए क्या हुआ, ताकि परिवार मदद कर सके।" : "Tell us what happened so your family can help."],
        action: await doseLink(d.whyMissed),
      };
    }
    case "caretaker_alert":
    case "family_alert": {
      if (!dose) return null;
      const caretaker = job.kind === "caretaker_alert";
      return {
        to: member.email,
        subject: `${elderName} has not logged ${dose.medName} yet`,
        heading: `${dose.medName} (${formatTime(dose.scheduledFor)}) is still not logged`,
        lines: [
          `${elderName} was reminded but has not marked this dose as taken.`,
          caretaker ? "You can check in, or log it on their behalf with a note." : "A gentle call might help.",
        ],
        action: caretaker ? await doseLink("Log or check this dose") : { label: "Open VridhaSuraksha", url: `${appUrl}/app` },
      };
    }
    case "appointment": {
      if (!appt) return null;
      return {
        to: member.email,
        lang,
        subject: `Doctor visit: ${appt.doctor}, ${formatDateTime(appt.startsAt)}`,
        heading: `Upcoming visit with ${appt.doctor}`,
        lines: [`When: ${formatDateTime(appt.startsAt)}`, `Where: ${appt.place}`, "A doctor visit brief is ready to print in the app."],
        action: { label: "Open the visit brief", url: `${appUrl}/app/brief?appointment=${encodeURIComponent(appt.id)}` },
      };
    }
    case "refill": {
      if (!med) return null;
      const f = forecastRefill(med.stock, med.unitsPerDose, med.schedule, new Date());
      return {
        to: member.email,
        subject: `Refill needed: ${med.name} for ${elderName}`,
        heading: `${med.name} is running low`,
        lines: [
          med.stock === 0
            ? `${elderName}'s ${med.name} has run out.`
            : `About ${f.daysLeft} day(s) left (${med.stock} units).`,
          "Tap below if you will handle the refill, so everyone else knows it is covered.",
        ],
        action: {
          label: "I'll handle it",
          url: await actionUrl({ kind: "refill", circleId: ctx.circle.id, memberId: member.id, ref: med.id }),
        },
      };
    }
    case "notify": {
      const p = job.payload;
      if (!p) return null;
      return { to: member.email, subject: p.subject, heading: p.subject, lines: [p.message], action: { label: "Open VridhaSuraksha", url: `${appUrl}/app` } };
    }
  }
}

type Outcome = "sent" | "cancelled";

/** Executes a claimed job. Returns "cancelled" when the job is no longer relevant. */
async function execute(db: Db, job: Job, now: Date): Promise<Outcome> {
  const circle = await db.get<Circle>(C.circles, job.circleId);
  if (!circle) return "cancelled";

  const [dose, med, appt, members] = await Promise.all([
    job.doseId ? db.get<DoseEvent>(C.doses(circle.id), job.doseId) : null,
    job.medicationId ? db.get<Medication>(C.medications(circle.id), job.medicationId) : null,
    job.appointmentId ? db.get<Appointment>(C.appointments(circle.id), job.appointmentId) : null,
    db.query<Member>(C.members(circle.id)),
  ]);

  if (job.doseId) {
    if (!dose || dose.status !== "PENDING") return "cancelled";
    if (job.kind === "mark_missed") {
      const marked = await db.transaction(async (tx) => {
        const fresh = await tx.get<DoseEvent>(C.doses(circle.id), dose.id);
        if (!fresh || fresh.status !== "PENDING") return false;
        tx.update(C.doses(circle.id), dose.id, { status: "MISSED" });
        return true;
      });
      if (!marked) return "cancelled";
      invalidateCircle(circle.id);
    }
  }
  if (job.kind === "appointment" && (!appt || appt.startsAt < now.toISOString())) return "cancelled";
  if (job.kind === "refill" && (!med || !med.active || (await openRefillClaim(db, circle.id, med.id)))) return "cancelled";

  const ctx: JobContext = { circle, elder: members.find((m) => m.id === circle.elderMemberId), dose, med, appt };
  const sentTo = [...job.sentTo];
  for (const member of recipients(members, job)) {
    if (sentTo.includes(member.id)) continue;
    const content = await composeFor(job, ctx, member);
    if (!content) continue;
    await sendEmail(renderEmail(content));
    sentTo.push(member.id);
    await db.update(C.jobs, job.id, { sentTo, updatedAt: new Date().toISOString() });
  }
  return "sent";
}

/** Claims a job in a transaction, executes it, and records the outcome with retry and backoff. */
export async function processJob(jobId: string, now = new Date()): Promise<Outcome | "skipped" | "retry" | "failed"> {
  const db = await getDb();
  const nowIso = now.toISOString();
  const claimed = await db.transaction(async (tx) => {
    const job = await tx.get<Job>(C.jobs, jobId);
    if (!job) return null;
    const claimable =
      (job.status === "pending" && job.dueAt <= nowIso) ||
      (job.status === "sending" && job.leaseUntil !== null && job.leaseUntil <= nowIso);
    if (!claimable) return null;
    const lease = { status: "sending" as const, leaseUntil: addMinutes(now, LEASE_MIN).toISOString(), attempts: job.attempts + 1, updatedAt: nowIso };
    tx.update(C.jobs, jobId, lease);
    return { ...job, ...lease };
  });
  if (!claimed) return "skipped";

  try {
    const outcome = await execute(db, claimed, now);
    await db.update(C.jobs, jobId, { status: outcome, leaseUntil: null, lastError: null, updatedAt: new Date().toISOString() });
    return outcome;
  } catch (err) {
    const message = errorMessage(err).slice(0, 300);
    const final = claimed.attempts >= MAX_ATTEMPTS;
    await db.update(C.jobs, jobId, {
      status: final ? "failed" : "pending",
      leaseUntil: null,
      lastError: message,
      dueAt: final ? claimed.dueAt : addMinutes(now, BACKOFF_MIN[claimed.attempts - 1] ?? 15).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    log.error("Reminder job failed", { jobId, kind: claimed.kind, attempt: claimed.attempts, final, error: message });
    return final ? "failed" : "retry";
  }
}

export interface TickResult {
  generated: boolean;
  processed: number;
  outcomes: Record<string, number>;
}

/** One scheduler tick: maybe generate, then process due and stale jobs. */
export async function tick(now = new Date()): Promise<TickResult> {
  const db = await getDb();
  const generated = await maybeGenerate(now);
  const nowIso = now.toISOString();
  const [due, stale] = await Promise.all([
    db.query<Job>(C.jobs, {
      where: [
        ["status", "==", "pending"],
        ["dueAt", "<=", nowIso],
      ],
      orderBy: { field: "dueAt" },
      limit: TICK_BATCH,
    }),
    db.query<Job>(C.jobs, {
      where: [
        ["status", "==", "sending"],
        ["leaseUntil", "<=", nowIso],
      ],
      limit: 10,
    }),
  ]);
  const outcomes: Record<string, number> = {};
  for (const job of [...due, ...stale]) {
    const outcome = await processJob(job.id, now);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return { generated, processed: due.length + stale.length, outcomes };
}
