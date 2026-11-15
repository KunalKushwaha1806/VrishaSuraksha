/** Firestore document shapes. All timestamps are UTC ISO-8601 strings. */

export type Role = "ELDER" | "CARETAKER" | "FAMILY";
export type Lang = "en" | "hi";
export type Criticality = "high" | "normal" | "low";
export type DoseStatus = "PENDING" | "TAKEN" | "SKIPPED" | "MISSED";
export type MissedReason = "forgot" | "unwell" | "side_effect" | "ran_out";

/** What a family member may see. Set per member by the elder. Caretakers and the elder see everything. */
export interface Visibility {
  doses: boolean;
  missedReasons: boolean;
  symptoms: boolean;
  appointments: boolean;
  stock: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface Circle {
  id: string;
  name: string;
  code: string;
  elderMemberId: string;
  emergencyContacts: EmergencyContact[];
  isDemo: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  circleId: string;
  name: string;
  email: string;
  emailLower: string;
  role: Role;
  passcodeHash: string;
  language: Lang;
  visibility: Visibility;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface Invite {
  id: string;
  role: Exclude<Role, "ELDER">;
  codeHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdById: string;
  createdAt: string;
}

export interface Schedule {
  /** Clock times in India, "HH:MM". */
  times: string[];
  /** Days of week, 0 = Sunday. */
  days: number[];
  /** Indian calendar days "YYYY-MM-DD". */
  startDate: string;
  endDate: string | null;
}

export interface Medication {
  id: string;
  circleId: string;
  name: string;
  doseText: string;
  form: string;
  criticality: Criticality;
  stock: number;
  unitsPerDose: number;
  notesEnc: string | null;
  schedule: Schedule;
  active: boolean;
  explanations: Partial<Record<Lang, string>>;
  createdAt: string;
  updatedAt: string;
}

export interface DoseEvent {
  id: string;
  circleId: string;
  medicationId: string;
  medName: string;
  dayKey: string;
  scheduledFor: string;
  status: DoseStatus;
  loggedById: string | null;
  loggedByName: string | null;
  loggedAt: string | null;
  missedReason: MissedReason | null;
  noteEnc: string | null;
}

export interface Appointment {
  id: string;
  circleId: string;
  doctor: string;
  place: string;
  startsAt: string;
  notesEnc: string | null;
  reminderOffsetsMin: number[];
  createdAt: string;
}

export type JobKind =
  | "dose_due"
  | "elder_renudge"
  | "caretaker_alert"
  | "family_alert"
  | "mark_missed"
  | "appointment"
  | "refill"
  | "notify";

export type JobStatus = "pending" | "sending" | "sent" | "cancelled" | "failed";

export type Audience = "elder" | "caretakers" | "family" | "everyone";

export interface NotifyPayload {
  audience: Audience;
  subject: string;
  message: string;
  /** Visibility flag a family member needs to receive this notice. */
  requires?: keyof Visibility;
}

export interface Job {
  id: string;
  circleId: string;
  kind: JobKind;
  dueAt: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  leaseUntil: string | null;
  doseId: string | null;
  appointmentId: string | null;
  medicationId: string | null;
  payload: NotifyPayload | null;
  /** Member ids already emailed, so a retry never emails anyone twice. */
  sentTo: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RefillClaim {
  medicationId: string;
  claimedById: string;
  claimedByName: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface VoiceNote {
  id: string;
  circleId: string;
  fromMemberId: string;
  fromName: string;
  medicationId: string | null;
  mimeType: string;
  durationSec: number;
  audioEnc: string;
  createdAt: string;
  playedAt: string | null;
}

export type SymptomKind = "side_effect" | "unwell" | "note";

export interface SymptomEntry {
  id: string;
  circleId: string;
  kind: SymptomKind;
  textEnc: string | null;
  medicationId: string | null;
  doseId: string | null;
  createdById: string;
  createdAt: string;
}

export interface ShareToken {
  id: string;
  circleId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: Role | "SYSTEM";
  action: string;
  targetType: string;
  targetId: string | null;
  at: string;
}

export interface ConsentEntry {
  id: string;
  memberId: string;
  memberName: string;
  change: string;
  byId: string;
  at: string;
}

export type ReactionKind = "heart" | "proud" | "love" | "call_soon" | "take_care";

export interface Reaction {
  id: string;
  fromMemberId: string;
  fromName: string;
  kind: ReactionKind;
  createdAt: string;
}

/** Collection paths. Circle-owned data lives under the circle, so deleting a circle removes everything. */
export const C = {
  circles: "circles",
  members: (cid: string) => `circles/${cid}/members`,
  invites: (cid: string) => `circles/${cid}/invites`,
  medications: (cid: string) => `circles/${cid}/medications`,
  doses: (cid: string) => `circles/${cid}/doses`,
  appointments: (cid: string) => `circles/${cid}/appointments`,
  refillClaims: (cid: string) => `circles/${cid}/refillClaims`,
  voiceNotes: (cid: string) => `circles/${cid}/voiceNotes`,
  symptoms: (cid: string) => `circles/${cid}/symptoms`,
  shareTokens: (cid: string) => `circles/${cid}/shareTokens`,
  activity: (cid: string) => `circles/${cid}/activity`,
  consent: (cid: string) => `circles/${cid}/consent`,
  reactions: (cid: string) => `circles/${cid}/reactions`,
  jobs: "jobs",
  shareLookup: "shareLookup",
  usedActionTokens: "usedActionTokens",
  loginAttempts: "loginAttempts",
  system: "system",
} as const;
