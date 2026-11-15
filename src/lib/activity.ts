import { newId } from "./crypto";
import { getDb } from "./db";
import { C, type ActivityEntry, type ConsentEntry, type Member } from "./models";

type Actor = Pick<Member, "id" | "name" | "role"> | null;

/** Append-only audit trail of who viewed or changed what. Visible to the elder. */
export async function logActivity(
  circleId: string,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string | null = null,
): Promise<void> {
  const db = await getDb();
  const id = newId();
  const entry: ActivityEntry = {
    id,
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "System",
    actorRole: actor?.role ?? "SYSTEM",
    action,
    targetType,
    targetId,
    at: new Date().toISOString(),
  };
  await db.set(C.activity(circleId), id, entry);
}

/** Every change to what someone may see is recorded as consent history. */
export async function logConsent(circleId: string, member: Pick<Member, "id" | "name">, change: string, byId: string) {
  const db = await getDb();
  const id = newId();
  const entry: ConsentEntry = {
    id,
    memberId: member.id,
    memberName: member.name,
    change,
    byId,
    at: new Date().toISOString(),
  };
  await db.set(C.consent(circleId), id, entry);
}
