import { z } from "zod";
import { MAX_IMAGE_BYTES, MAX_VOICE_BYTES, MAX_VOICE_SECONDS, VOICE_MIME_TYPES } from "./limits";

export { MAX_IMAGE_BYTES, MAX_VOICE_BYTES, VOICE_MIME_TYPES };

/** Input schemas shared by API routes (server) and forms (client). */

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const passcodeSchema = z.string().min(6, "Use at least 6 characters").max(64, "Use at most 64 characters");

export const circleCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Circle codes have 6 letters or numbers");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
export const langSchema = z.enum(["en", "hi"]);
export const roleSchema = z.enum(["ELDER", "CARETAKER", "FAMILY"]);

export const createCircleSchema = z.object({
  circleName: trimmed(60),
  elderName: trimmed(60),
  email: emailSchema,
  passcode: passcodeSchema,
  language: langSchema.default("en"),
});

export const joinCircleSchema = z.object({
  circleCode: circleCodeSchema,
  inviteCode: z.string().trim().toUpperCase().min(6).max(12),
  name: trimmed(60),
  email: emailSchema,
  passcode: passcodeSchema,
  language: langSchema.default("en"),
});

export const loginSchema = z.object({
  circleCode: circleCodeSchema,
  email: emailSchema,
  passcode: z.string().min(1).max(64),
});

export const inviteSchema = z.object({ role: z.enum(["CARETAKER", "FAMILY"]) });

export const visibilitySchema = z.object({
  doses: z.boolean(),
  missedReasons: z.boolean(),
  symptoms: z.boolean(),
  appointments: z.boolean(),
  stock: z.boolean(),
});

export const memberUpdateSchema = z.object({
  visibility: visibilitySchema.optional(),
  active: z.literal(false).optional(),
});

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const scheduleSchema = z.object({
  times: z.array(timeOfDay).min(1, "Add at least one time").max(8),
  days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one day").max(7),
  startDate: dayKey,
  endDate: dayKey.nullable().default(null),
});

export const medicationSchema = z.object({
  name: trimmed(80),
  doseText: trimmed(60),
  form: z.enum(["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "other"]).default("tablet"),
  criticality: z.enum(["high", "normal", "low"]).default("normal"),
  stock: z.number().int().min(0).max(10_000),
  unitsPerDose: z.number().positive().max(20).default(1),
  notes: optionalText(500),
  schedule: scheduleSchema,
});

export const medicationUpdateSchema = medicationSchema.partial();

export const logDoseSchema = z
  .object({
    status: z.enum(["TAKEN", "SKIPPED", "MISSED"]),
    reason: z.enum(["forgot", "unwell", "side_effect", "ran_out"]).optional(),
    note: optionalText(300),
    confirmDouble: z.boolean().optional(),
  })
  .refine((v) => v.status !== "MISSED" || v.reason, { message: "Pick a reason", path: ["reason"] });

export const appointmentSchema = z.object({
  doctor: trimmed(80),
  place: trimmed(120),
  startsAt: z.string().datetime({ offset: true }),
  notes: optionalText(500),
  reminderOffsetsMin: z
    .array(
      z
        .number()
        .int()
        .min(10)
        .max(7 * 24 * 60),
    )
    .max(4)
    .default([24 * 60, 120]),
});

export const symptomSchema = z.object({
  kind: z.enum(["side_effect", "unwell", "note"]),
  text: trimmed(500),
  medicationId: z.string().max(64).optional(),
});

export const reactionSchema = z.object({ kind: z.enum(["heart", "proud", "love", "call_soon", "take_care"]) });

export const voiceNoteSchema = z.object({
  mimeType: z
    .string()
    .transform((v) => v.split(";")[0])
    .pipe(z.enum(VOICE_MIME_TYPES)),
  durationSec: z.number().min(1).max(MAX_VOICE_SECONDS),
  audioBase64: z
    .string()
    .min(10)
    .max(Math.ceil((MAX_VOICE_BYTES * 4) / 3) + 8),
  medicationId: z.string().max(64).nullable().default(null),
});

export const prescriptionScanSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  imageBase64: z
    .string()
    .min(100)
    .max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8),
});

export const prescriptionApplySchema = z.object({
  items: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("added"),
          name: trimmed(80),
          doseText: trimmed(60),
          times: z.array(timeOfDay).min(1).max(8),
          durationDays: z.number().int().min(1).max(365).nullable(),
          stock: z.number().int().min(0).max(10_000).default(0),
        }),
        z.object({
          kind: z.literal("changed"),
          medicationId: z.string().min(1).max(64),
          doseText: trimmed(60),
          times: z.array(timeOfDay).min(1).max(8),
        }),
        z.object({ kind: z.literal("stopped"), medicationId: z.string().min(1).max(64) }),
      ]),
    )
    .min(1)
    .max(30),
});

export const explainSchema = z.object({ medicationId: z.string().min(1).max(64), language: langSchema });

export const shareCreateSchema = z.object({ hours: z.union([z.literal(24), z.literal(72), z.literal(168)]) });

export const emergencyContactsSchema = z.object({
  emergencyContacts: z
    .array(
      z.object({
        name: trimmed(60),
        phone: z
          .string()
          .trim()
          .regex(/^[+\d][\d\s-]{6,18}$/, "Enter a phone number"),
      }),
    )
    .max(4),
});

export const languageSchema = z.object({ language: langSchema });

export const actionSchema = z.object({
  token: z.string().min(20).max(2000),
  choice: z.enum(["taken", "forgot", "unwell", "side_effect", "ran_out", "claim"]),
});

export const deleteCircleSchema = z.object({ confirm: z.string().trim().min(1).max(60) });

export const demoLoginSchema = z.object({ role: roleSchema, member: z.enum(["arjun", "riya"]).optional() });
