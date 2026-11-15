import { setDbForTests } from "@/lib/db";
import { MemoryDb } from "@/lib/db/memory";
import { DEFAULT_FAMILY_VISIBILITY, FULL_VISIBILITY } from "@/lib/domain/permissions";
import { setMailerForTests, type EmailMessage } from "@/lib/email";
import { C, type Circle, type Medication, type Member, type Role, type Schedule, type Visibility } from "@/lib/models";

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export interface Harness {
  db: MemoryDb;
  sent: EmailMessage[];
  circle: Circle;
  elder: Member;
  caretaker: Member;
  family: Member;
  /** Makes the next N sends fail (simulates an SMTP outage). */
  failNext: (n: number) => void;
}

export function makeMember(circleId: string, id: string, role: Role, visibility?: Partial<Visibility>): Member {
  return {
    id,
    circleId,
    name: id,
    email: `${id}@test.local`,
    emailLower: `${id}@test.local`,
    role,
    passcodeHash: "x",
    language: "en",
    visibility: role === "FAMILY" ? { ...DEFAULT_FAMILY_VISIBILITY, ...visibility } : FULL_VISIBILITY,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
  };
}

/** Fresh in-memory database with one circle: an elder, a caretaker and one family member. */
export async function harness(): Promise<Harness> {
  const db = new MemoryDb();
  setDbForTests(db);
  const sent: EmailMessage[] = [];
  let failures = 0;
  setMailerForTests(async (m) => {
    if (failures > 0) {
      failures--;
      throw new Error("SMTP unavailable");
    }
    sent.push(m);
  });

  const circle: Circle = {
    id: "c1",
    name: "Test family",
    code: "TEST01",
    elderMemberId: "elder",
    emergencyContacts: [],
    isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const elder = makeMember("c1", "elder", "ELDER");
  const caretaker = makeMember("c1", "caretaker", "CARETAKER");
  const family = makeMember("c1", "family", "FAMILY");
  await db.set(C.circles, circle.id, circle);
  await db.set("circleCodes", circle.code, { circleId: circle.id });
  for (const m of [elder, caretaker, family]) await db.set(C.members(circle.id), m.id, m);
  return { db, sent, circle, elder, caretaker, family, failNext: (n) => (failures = n) };
}

export function medication(overrides: Partial<Medication> & { schedule: Schedule }): Medication {
  return {
    id: "m1",
    circleId: "c1",
    name: "Metformin",
    doseText: "500 mg",
    form: "tablet",
    criticality: "normal",
    stock: 30,
    unitsPerDose: 1,
    notesEnc: null,
    active: true,
    explanations: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
