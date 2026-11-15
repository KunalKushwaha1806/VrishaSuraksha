import { logActivity, logConsent } from "../activity";
import { hashPasscode, verifyPasscode } from "../auth/passcode";
import { invalidateCircle } from "../cache";
import { decryptText, humanCode, newId } from "../crypto";
import { getDb } from "../db";
import { DEFAULT_FAMILY_VISIBILITY, FULL_VISIBILITY } from "../domain/permissions";
import { fail } from "../http";
import {
  C,
  type Appointment,
  type Circle,
  type DoseEvent,
  type Invite,
  type Lang,
  type Medication,
  type Member,
  type Role,
  type ShareToken,
  type SymptomEntry,
  type Visibility,
  type Job,
} from "../models";
import { clearFailures, lockedFor, recordFailure } from "../ratelimit";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPasscode("timing-equaliser-not-a-passcode"));
const CIRCLE_CODES = "circleCodes";

/** Public view of a member: never includes the passcode hash. */
export function publicMember(m: Member) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    language: m.language,
    visibility: m.visibility,
    active: m.active,
    email: m.email,
    createdAt: m.createdAt,
  };
}

export async function findCircleByCode(code: string): Promise<Circle | null> {
  const db = await getDb();
  const ref = await db.get<{ circleId: string }>(CIRCLE_CODES, code.toUpperCase());
  return ref ? db.get<Circle>(C.circles, ref.circleId) : null;
}

function buildMember(input: {
  circleId: string;
  name: string;
  email: string;
  role: Role;
  passcodeHash: string;
  language: Lang;
}): Member {
  return {
    id: newId(),
    circleId: input.circleId,
    name: input.name,
    email: input.email,
    emailLower: input.email.toLowerCase(),
    role: input.role,
    passcodeHash: input.passcodeHash,
    language: input.language,
    visibility: input.role === "FAMILY" ? DEFAULT_FAMILY_VISIBILITY : FULL_VISIBILITY,
    active: true,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
}

/** The elder creates their own circle and becomes its owner. */
export async function createCircle(input: {
  circleName: string;
  elderName: string;
  email: string;
  passcode: string;
  language: Lang;
}): Promise<{ circle: Circle; member: Member }> {
  const db = await getDb();
  const circleId = newId();
  let code = "";
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = humanCode(6);
    if (await db.create(CIRCLE_CODES, candidate, { circleId })) code = candidate;
  }
  if (!code) throw new Error("Could not allocate a circle code");

  const member = buildMember({
    circleId,
    name: input.elderName,
    email: input.email,
    role: "ELDER",
    passcodeHash: await hashPasscode(input.passcode),
    language: input.language,
  });
  const circle: Circle = {
    id: circleId,
    name: input.circleName,
    code,
    elderMemberId: member.id,
    emergencyContacts: [],
    isDemo: false,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.circles, circleId, circle);
  await db.set(C.members(circleId), member.id, member);
  await logActivity(circleId, member, "created the circle", "circle", circleId);
  return { circle, member };
}

/** Issues a one-time invite passcode. Only its hash is stored; the plain code is shown once. */
export async function createInvite(
  circle: Circle,
  actor: Member,
  role: Invite["role"],
): Promise<{ code: string; expiresAt: string }> {
  const db = await getDb();
  const code = humanCode(8);
  const invite: Invite = {
    id: newId(),
    role,
    codeHash: await hashPasscode(code),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    usedAt: null,
    createdById: actor.id,
    createdAt: new Date().toISOString(),
  };
  await db.set(C.invites(circle.id), invite.id, invite);
  await logActivity(circle.id, actor, `created a ${role.toLowerCase()} invite`, "invite", invite.id);
  return { code, expiresAt: invite.expiresAt };
}

async function guardAttempts(key: string): Promise<void> {
  const wait = await lockedFor(key);
  if (wait > 0) throw fail.tooMany(wait);
}

/** Joins a circle with a circle code plus a one-time invite passcode. */
export async function joinCircle(input: {
  circleCode: string;
  inviteCode: string;
  name: string;
  email: string;
  passcode: string;
  language: Lang;
}): Promise<{ circle: Circle; member: Member }> {
  const lockKey = `join:${input.circleCode}`;
  await guardAttempts(lockKey);
  const db = await getDb();
  const circle = await findCircleByCode(input.circleCode);
  const nowIso = new Date().toISOString();
  const invites = circle
    ? (await db.query<Invite>(C.invites(circle.id), { where: [["usedAt", "==", null]] })).filter(
        (i) => i.expiresAt > nowIso,
      )
    : [];

  let match: Invite | null = null;
  for (const invite of invites) {
    if (await verifyPasscode(input.inviteCode, invite.codeHash)) {
      match = invite;
      break;
    }
  }
  if (!circle || !match) {
    await recordFailure(lockKey);
    throw fail.badRequest(
      "That circle code or invite passcode is not valid. Ask the elder or caretaker for a fresh invite.",
    );
  }

  const existing = await db.query<Member>(C.members(circle.id), {
    where: [["emailLower", "==", input.email.toLowerCase()]],
  });
  if (existing.some((m) => m.active))
    throw fail.conflict("Someone with this email is already in the circle. Please sign in instead.");

  const member = buildMember({
    circleId: circle.id,
    name: input.name,
    email: input.email,
    role: match.role,
    passcodeHash: await hashPasscode(input.passcode),
    language: input.language,
  });
  const inviteId = match.id;
  const claimed = await db.transaction(async (tx) => {
    const fresh = await tx.get<Invite>(C.invites(circle.id), inviteId);
    if (!fresh || fresh.usedAt) return false;
    tx.update(C.invites(circle.id), inviteId, { usedAt: nowIso });
    tx.set(C.members(circle.id), member.id, member);
    return true;
  });
  if (!claimed) throw fail.conflict("This invite was just used. Ask for a new one.");

  await clearFailures(lockKey);
  await logActivity(circle.id, member, `joined as ${member.role.toLowerCase()}`, "member", member.id);
  await logConsent(
    circle.id,
    member,
    `joined with ${member.role === "FAMILY" ? "default family" : "full"} visibility`,
    member.id,
  );
  invalidateCircle(circle.id);
  return { circle, member };
}

/** Signs in with circle code, email and personal passcode. Locks after repeated failures. */
export async function login(input: { circleCode: string; email: string; passcode: string }): Promise<Member> {
  const lockKey = `login:${input.circleCode}:${input.email.toLowerCase()}`;
  await guardAttempts(lockKey);
  const db = await getDb();
  const circle = await findCircleByCode(input.circleCode);
  const members = circle
    ? await db.query<Member>(C.members(circle.id), { where: [["emailLower", "==", input.email.toLowerCase()]] })
    : [];
  const member = members.find((m) => m.active);
  // Always run one bcrypt comparison so response time does not reveal whether the account exists.
  const ok = await verifyPasscode(input.passcode, member?.passcodeHash ?? (await dummyHash()));
  if (!member || !ok) {
    await recordFailure(lockKey);
    throw fail.unauthorized("Those details did not match. Check the circle code, email and passcode.");
  }
  await clearFailures(lockKey);
  return member;
}

export async function listMembers(circleId: string): Promise<Member[]> {
  const db = await getDb();
  const members = await db.query<Member>(C.members(circleId));
  return members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Elder-only: change what a family member can see, or revoke a member immediately. */
export async function updateMember(
  circle: Circle,
  elder: Member,
  memberId: string,
  change: { visibility?: Visibility; active?: false },
): Promise<Member> {
  const db = await getDb();
  const target = await db.get<Member>(C.members(circle.id), memberId);
  if (!target) throw fail.notFound("Member not found.");
  if (target.id === circle.elderMemberId) throw fail.badRequest("The elder's own access cannot be changed here.");

  if (change.visibility) {
    if (target.role !== "FAMILY") throw fail.badRequest("Caretakers need full access to manage care.");
    await db.update(C.members(circle.id), target.id, { visibility: change.visibility });
    const shown = Object.entries(change.visibility)
      .filter(([, v]) => v)
      .map(([k]) => k);
    await logConsent(circle.id, target, `can now see: ${shown.join(", ") || "nothing"}`, elder.id);
    await logActivity(circle.id, elder, `changed what ${target.name} can see`, "member", target.id);
  }
  if (change.active === false) {
    await db.update(C.members(circle.id), target.id, { active: false, revokedAt: new Date().toISOString() });
    await logConsent(circle.id, target, "access revoked", elder.id);
    await logActivity(circle.id, elder, `revoked ${target.name}'s access`, "member", target.id);
  }
  invalidateCircle(circle.id);
  return (await db.get<Member>(C.members(circle.id), target.id)) as Member;
}

/** Everything the circle holds about the elder, decrypted, for the "export my data" right. */
export async function exportCircle(circle: Circle) {
  const db = await getDb();
  const [members, meds, doses, appointments, symptoms, activity, consent] = await Promise.all([
    db.query<Member>(C.members(circle.id)),
    db.query<Medication>(C.medications(circle.id)),
    db.query<DoseEvent>(C.doses(circle.id)),
    db.query<Appointment>(C.appointments(circle.id)),
    db.query<SymptomEntry>(C.symptoms(circle.id)),
    db.query(C.activity(circle.id)),
    db.query(C.consent(circle.id)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    circle: { name: circle.name, createdAt: circle.createdAt, emergencyContacts: circle.emergencyContacts },
    members: members.map(publicMember),
    medications: meds.map(({ notesEnc, explanations, ...m }) => ({ ...m, notes: decryptText(notesEnc) })),
    doses: doses.map(({ noteEnc, ...d }) => ({ ...d, note: decryptText(noteEnc) })),
    appointments: appointments.map(({ notesEnc, ...a }) => ({ ...a, notes: decryptText(notesEnc) })),
    symptoms: symptoms.map(({ textEnc, ...s }) => ({ ...s, text: decryptText(textEnc) })),
    activity,
    consent,
  };
}

/** Permanently deletes the circle and everything in it, including pending reminders. */
export async function deleteCircle(circle: Circle): Promise<void> {
  const db = await getDb();
  const [jobs, tokens] = await Promise.all([
    db.query<Job>(C.jobs, { where: [["circleId", "==", circle.id]] }),
    db.query<ShareToken>(C.shareTokens(circle.id)),
  ]);
  await Promise.all([
    ...jobs.map((j) => db.delete(C.jobs, j.id)),
    ...tokens.map((tk) => db.delete(C.shareLookup, tk.tokenHash)),
    db.delete(CIRCLE_CODES, circle.code),
  ]);
  await db.deleteTree(C.circles, circle.id);
  invalidateCircle(circle.id);
}
