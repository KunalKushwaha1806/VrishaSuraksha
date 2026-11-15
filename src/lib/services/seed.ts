import { invalidateCircle } from "../cache";
import { encryptText } from "../crypto";
import { getDb } from "../db";
import { DEFAULT_FAMILY_VISIBILITY, FULL_VISIBILITY } from "../domain/permissions";
import { occurrencesBetween } from "../domain/schedule";
import { env } from "../env";
import {
  C,
  type Appointment,
  type Circle,
  type DoseEvent,
  type Medication,
  type Member,
  type MissedReason,
  type Reaction,
  type Role,
  type SymptomEntry,
} from "../models";
import { addDays, addMinutes, istDayKey, istToUtc } from "../time";
import { deleteCircle } from "./circles";
import { doseIdFor, generateUpcoming, materializeDoses, scheduleAppointmentJobs } from "./engine";

/**
 * Demo circle used by the one-click demo. Everything is fictional.
 * Emails go to DEMO_INBOX with plus-addressing (you+elder@...) when set,
 * otherwise to example.com addresses that are never actually emailed.
 */
export const DEMO_CIRCLE_ID = "demo-circle";
export const DEMO_CODE = "DEMO24";
export const DEMO_PASSCODE = "246810";

export const DEMO_MEMBERS = {
  elder: "demo-elder",
  caretaker: "demo-caretaker",
  arjun: "demo-arjun",
  riya: "demo-riya",
} as const;

function demoEmail(tag: string): string {
  const inbox = env().DEMO_INBOX;
  if (!inbox) return `${tag}@example.com`;
  const [local, domain] = inbox.split("@");
  return `${local}+${tag}@${domain}`;
}

interface MedSeed {
  id: string;
  name: string;
  doseText: string;
  criticality: Medication["criticality"];
  times: string[];
  days?: number[];
  stock: number;
  notes?: string;
}

const MEDS: MedSeed[] = [
  { id: "demo-metformin", name: "Metformin", doseText: "500 mg", criticality: "normal", times: ["08:30", "20:30"], stock: 54, notes: "Take after food." },
  { id: "demo-amlodipine", name: "Amlodipine", doseText: "5 mg", criticality: "high", times: ["09:00"], stock: 4, notes: "For blood pressure." },
  { id: "demo-atorvastatin", name: "Atorvastatin", doseText: "10 mg", criticality: "normal", times: ["21:30"], stock: 25 },
  { id: "demo-aspirin", name: "Ecosprin", doseText: "75 mg", criticality: "high", times: ["14:00"], stock: 28, notes: "After lunch." },
  { id: "demo-pantoprazole", name: "Pantoprazole", doseText: "40 mg", criticality: "low", times: ["07:30"], stock: 30, notes: "Before breakfast." },
  { id: "demo-vitd", name: "Vitamin D3", doseText: "60,000 IU", criticality: "low", times: ["10:00"], days: [0], stock: 6 },
];

/** Misses sprinkled through history: [days ago, medicine id, reason]. */
const MISSES: Array<[number, string, MissedReason]> = [
  [5, "demo-atorvastatin", "side_effect"],
  [5, "demo-metformin", "forgot"],
  [6, "demo-aspirin", "unwell"],
];

function member(id: string, name: string, tag: string, role: Role, hash: string, extra: Partial<Member> = {}): Member {
  return {
    id,
    circleId: DEMO_CIRCLE_ID,
    name,
    email: demoEmail(tag),
    emailLower: demoEmail(tag).toLowerCase(),
    role,
    passcodeHash: hash,
    language: "en",
    visibility: role === "FAMILY" ? DEFAULT_FAMILY_VISIBILITY : FULL_VISIBILITY,
    active: true,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
    revokedAt: null,
    ...extra,
  };
}

export const DEMO_PASSCODE_HASH = "$2b$12$f.X/IJ7ByJy3UNf4BH6Ut.euLyqfkep0ehipSdvuAMuCugLFO05Yu";

export async function seedDemo(now = new Date()): Promise<Circle> {
  const db = await getDb();
  const hash = DEMO_PASSCODE_HASH;
  const created = new Date(now.getTime() - 20 * 86_400_000).toISOString();
  const today = istDayKey(now);
  const cid = DEMO_CIRCLE_ID;

  const circle: Circle = {
    id: cid,
    name: "Sharma family",
    code: DEMO_CODE,
    elderMemberId: DEMO_MEMBERS.elder,
    emergencyContacts: [
      { name: "Sunita (caretaker)", phone: "+91 98765 43210" },
      { name: "Arjun (son)", phone: "+91 91234 56789" },
    ],
    isDemo: true,
    createdAt: created,
  };
  await db.set(C.circles, cid, circle);
  await db.set("circleCodes", DEMO_CODE, { circleId: cid });

  const members = [
    member(DEMO_MEMBERS.elder, "Ramesh Sharma (Dadaji)", "elder", "ELDER", hash, { language: "hi" }),
    member(DEMO_MEMBERS.caretaker, "Sunita", "caretaker", "CARETAKER", hash),
    member(DEMO_MEMBERS.arjun, "Arjun", "arjun", "FAMILY", hash, { visibility: { ...DEFAULT_FAMILY_VISIBILITY, missedReasons: true, symptoms: true } }),
    member(DEMO_MEMBERS.riya, "Riya", "riya", "FAMILY", hash),
  ];
  await Promise.all(members.map((m) => db.set(C.members(cid), m.id, m)));

  const meds: Medication[] = MEDS.map((m) => ({
    id: m.id,
    circleId: cid,
    name: m.name,
    doseText: m.doseText,
    form: "tablet",
    criticality: m.criticality,
    stock: m.stock,
    unitsPerDose: 1,
    notesEnc: encryptText(m.notes),
    schedule: { times: m.times, days: m.days ?? [0, 1, 2, 3, 4, 5, 6], startDate: addDays(today, -20), endDate: null },
    active: true,
    explanations: {},
    createdAt: created,
    updatedAt: created,
  }));
  await Promise.all(meds.map((m) => db.set(C.medications(cid), m.id, m)));

  // A week of history, all taken except the scripted misses. Today's past doses are taken too.
  const historyStart = istToUtc(addDays(today, -7), "00:00");
  const doses: DoseEvent[] = [];
  for (const med of meds) {
    for (const occ of occurrencesBetween(med.schedule, historyStart, now)) {
      const daysAgo = Math.round((istToUtc(today, "00:00").getTime() - istToUtc(occ.dayKey, "00:00").getTime()) / 86_400_000);
      const miss = MISSES.find(([d, id]) => d === daysAgo && id === med.id);
      // Doses from the last three hours stay open so the demo always has something to log.
      if (occ.at.getTime() > now.getTime() - 3 * 3_600_000) {
        doses.push({
          id: doseIdFor(cid, med.id, occ.at),
          circleId: cid,
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
        });
        continue;
      }
      doses.push({
        id: doseIdFor(cid, med.id, occ.at),
        circleId: cid,
        medicationId: med.id,
        medName: med.name,
        dayKey: occ.dayKey,
        scheduledFor: occ.at.toISOString(),
        status: miss ? "MISSED" : "TAKEN",
        loggedById: DEMO_MEMBERS.elder,
        loggedByName: "Ramesh Sharma (Dadaji)",
        loggedAt: addMinutes(occ.at, miss ? 95 : 6).toISOString(),
        missedReason: miss ? miss[2] : null,
        noteEnc: null,
      });
    }
  }
  await Promise.all(doses.map((d) => db.set(C.doses(cid), d.id, d)));

  const symptom: SymptomEntry = {
    id: "demo-symptom-1",
    circleId: cid,
    kind: "side_effect",
    textEnc: encryptText("Felt dizzy and had leg cramps after the night tablet."),
    medicationId: "demo-atorvastatin",
    doseId: null,
    createdById: DEMO_MEMBERS.elder,
    createdAt: istToUtc(addDays(today, -5), "22:10").toISOString(),
  };
  await db.set(C.symptoms(cid), symptom.id, symptom);

  const appointments: Appointment[] = [
    {
      id: "demo-appt-cardio",
      circleId: cid,
      doctor: "Dr. Mehta (Cardiologist)",
      place: "City Heart Clinic, Lajpat Nagar",
      startsAt: istToUtc(addDays(today, 2), "11:00").toISOString(),
      notesEnc: encryptText("Bring BP diary and last ECG."),
      reminderOffsetsMin: [24 * 60, 120],
      createdAt: created,
    },
    {
      id: "demo-appt-diabetes",
      circleId: cid,
      doctor: "Dr. Iyer (Diabetologist)",
      place: "Apollo Clinic, Saket",
      startsAt: istToUtc(addDays(today, 9), "17:30").toISOString(),
      notesEnc: encryptText("Fasting sugar test the same morning."),
      reminderOffsetsMin: [24 * 60, 120],
      createdAt: created,
    },
  ];
  await Promise.all(appointments.map((a) => db.set(C.appointments(cid), a.id, a)));
  await Promise.all(appointments.map((a) => scheduleAppointmentJobs(db, a, now)));

  const reaction: Reaction = {
    id: "demo-reaction-1",
    fromMemberId: DEMO_MEMBERS.riya,
    fromName: "Riya",
    kind: "proud",
    createdAt: addMinutes(now, -90).toISOString(),
  };
  await db.set(C.reactions(cid), reaction.id, reaction);

  // Upcoming doses (and their reminder ladders) for the next 48 hours.
  await Promise.all(meds.map((m) => materializeDoses(db, m, now, addMinutes(now, 48 * 60), now)));
  await generateUpcoming(now);
  invalidateCircle(cid);
  return circle;
}

/** Seeds the demo circle once; later calls reuse it. */
export async function ensureDemo(): Promise<Circle> {
  const db = await getDb();
  const existing = await db.get<Circle>(C.circles, DEMO_CIRCLE_ID);
  return existing ?? seedDemo();
}

/** Wipes and reseeds the demo circle so every judge starts from the same story. */
export async function resetDemo(): Promise<Circle> {
  const db = await getDb();
  const existing = await db.get<Circle>(C.circles, DEMO_CIRCLE_ID);
  if (existing) await deleteCircle(existing);
  return seedDemo();
}
