import type { Member, Role, Visibility } from "../models";

/**
 * Role-based access control. Every API route declares one permission and
 * the shared route wrapper enforces it on the server. The elder owns the
 * circle; caretakers manage care; family is read-mostly.
 */
export type Permission =
  | "circle:read"
  | "meds:read"
  | "meds:write"
  | "doses:read"
  | "doses:log"
  | "appointments:read"
  | "appointments:write"
  | "members:read"
  | "members:invite"
  | "members:revoke"
  | "privacy:manage"
  | "voice:send"
  | "voice:listen"
  | "reactions:send"
  | "refill:claim"
  | "symptoms:read"
  | "symptoms:write"
  | "prescription:scan"
  | "explain:use"
  | "brief:read"
  | "share:manage"
  | "activity:read"
  | "data:export"
  | "data:delete";

const ELDER_ONLY: Permission[] = [
  "members:revoke",
  "privacy:manage",
  "share:manage",
  "activity:read",
  "data:export",
  "data:delete",
];

const FAMILY: Permission[] = [
  "circle:read",
  "meds:read",
  "doses:read",
  "appointments:read",
  "members:read",
  "voice:send",
  "reactions:send",
  "refill:claim",
  "symptoms:read",
];

const ALL: Permission[] = [
  "circle:read",
  "meds:read",
  "meds:write",
  "doses:read",
  "doses:log",
  "appointments:read",
  "appointments:write",
  "members:read",
  "members:invite",
  "members:revoke",
  "privacy:manage",
  "voice:send",
  "voice:listen",
  "reactions:send",
  "refill:claim",
  "symptoms:read",
  "symptoms:write",
  "prescription:scan",
  "explain:use",
  "brief:read",
  "share:manage",
  "activity:read",
  "data:export",
  "data:delete",
];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  ELDER: new Set(ALL),
  CARETAKER: new Set(ALL.filter((p) => !ELDER_ONLY.includes(p))),
  FAMILY: new Set(FAMILY),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

export const DEFAULT_FAMILY_VISIBILITY: Visibility = {
  doses: true,
  missedReasons: false,
  symptoms: false,
  appointments: true,
  stock: true,
};

export const FULL_VISIBILITY: Visibility = {
  doses: true,
  missedReasons: true,
  symptoms: true,
  appointments: true,
  stock: true,
};

/** What this member is allowed to see. Only family members are restricted. */
export function visibilityOf(member: Pick<Member, "role" | "visibility">): Visibility {
  return member.role === "FAMILY" ? { ...DEFAULT_FAMILY_VISIBILITY, ...member.visibility } : FULL_VISIBILITY;
}

export function canSee(member: Pick<Member, "role" | "visibility">, field: keyof Visibility): boolean {
  return visibilityOf(member)[field];
}

/**
 * Asserts the caller has one of the allowed roles, throwing a 403 ApiError if not.
 */
export function requireRole(member: Pick<Member, "role">, ...allowed: Role[]): void {
  if (!allowed.includes(member.role)) {
    throw new Error(`Unauthorized role: requires one of ${allowed.join(", ")}, got ${member.role}`);
  }
}

