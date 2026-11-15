import { describe, expect, it } from "vitest";
import {
  actionSchema,
  appointmentSchema,
  createCircleSchema,
  inviteSchema,
  joinCircleSchema,
  logDoseSchema,
  loginSchema,
  medicationSchema,
  reactionSchema,
  symptomSchema,
  voiceNoteSchema,
} from "@/lib/validation";

describe("Validation Schemas", () => {
  describe("actionSchema", () => {
    it("accepts valid token and actions", () => {
      const valid = actionSchema.safeParse({ token: "eyJhbGciOiJIUzI1NiJ9.test-valid-token-string", choice: "taken" });
      expect(valid.success).toBe(true);

      const claim = actionSchema.safeParse({ token: "eyJhbGciOiJIUzI1NiJ9.test-valid-token-string", choice: "claim" });
      expect(claim.success).toBe(true);

      const missed = actionSchema.safeParse({ token: "eyJhbGciOiJIUzI1NiJ9.test-valid-token-string", choice: "forgot" });
      expect(missed.success).toBe(true);
    });

    it("rejects invalid choices", () => {
      const invalid = actionSchema.safeParse({ token: "eyJhbGciOiJIUzI1NiJ9.test-valid-token-string", choice: "invalid_choice" });
      expect(invalid.success).toBe(false);
    });
  });

  describe("appointmentSchema", () => {
    it("accepts valid appointment details", () => {
      const res = appointmentSchema.safeParse({
        doctor: "Dr. Sharma (Cardiology)",
        place: "Max Hospital, Saket",
        startsAt: "2026-11-20T10:00:00.000Z",
        notes: "Bring previous ECG report",
        reminderOffsetsMin: [60, 1440],
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty doctor name or invalid date", () => {
      expect(appointmentSchema.safeParse({ doctor: "", place: "Clinic", startsAt: "invalid" }).success).toBe(false);
    });
  });

  describe("createCircleSchema & joinCircleSchema & loginSchema", () => {
    it("validates circle creation input", () => {
      const res = createCircleSchema.safeParse({
        circleName: "Sharma Family",
        elderName: "Dadaji",
        email: "dadaji@example.com",
        passcode: "123456",
        language: "hi",
      });
      expect(res.success).toBe(true);
    });

    it("rejects invalid emails or short passcodes", () => {
      const res = createCircleSchema.safeParse({
        circleName: "Sharma Family",
        elderName: "Dadaji",
        email: "not-an-email",
        passcode: "12",
        language: "en",
      });
      expect(res.success).toBe(false);
    });

    it("validates circle join input", () => {
      expect(
        joinCircleSchema.safeParse({
          circleCode: "SHAR01",
          inviteCode: "INVITE12",
          name: "Arjun",
          email: "arjun@example.com",
          passcode: "123456",
          language: "en",
        }).success,
      ).toBe(true);
    });

    it("validates login schema", () => {
      expect(
        loginSchema.safeParse({
          circleCode: "SHAR01",
          email: "arjun@example.com",
          passcode: "123456",
        }).success,
      ).toBe(true);
    });
  });

  describe("logDoseSchema", () => {
    it("validates TAKEN dose logs", () => {
      expect(logDoseSchema.safeParse({ status: "TAKEN" }).success).toBe(true);
      expect(logDoseSchema.safeParse({ status: "TAKEN", note: "Taken with warm milk" }).success).toBe(true);
    });

    it("requires a valid reason when dose is MISSED", () => {
      expect(logDoseSchema.safeParse({ status: "MISSED", reason: "ran_out" }).success).toBe(true);
      expect(logDoseSchema.safeParse({ status: "MISSED", reason: "side_effect" }).success).toBe(true);
      expect(logDoseSchema.safeParse({ status: "MISSED" }).success).toBe(false);
    });
  });

  describe("medicationSchema", () => {
    it("accepts valid medication and schedule", () => {
      const res = medicationSchema.safeParse({
        name: "Amlodipine",
        doseText: "5 mg",
        form: "tablet",
        criticality: "high",
        stock: 30,
        unitsPerDose: 1,
        schedule: {
          times: ["08:00"],
          days: [0, 1, 2, 3, 4, 5, 6],
          startDate: "2026-01-01",
          endDate: null,
        },
      });
      expect(res.success).toBe(true);
    });

    it("rejects negative stock or empty times", () => {
      expect(
        medicationSchema.safeParse({
          name: "Amlodipine",
          doseText: "5 mg",
          form: "tablet",
          criticality: "high",
          stock: -5,
          unitsPerDose: 1,
          schedule: { times: [], days: [1], startDate: "2026-01-01", endDate: null },
        }).success,
      ).toBe(false);
    });
  });

  describe("symptomSchema & voiceNoteSchema & reactionSchema", () => {
    it("validates symptom diary entry", () => {
      expect(symptomSchema.safeParse({ kind: "side_effect", text: "Mild dizziness in morning" }).success).toBe(true);
      expect(symptomSchema.safeParse({ kind: "note", text: "" }).success).toBe(false);
    });

    it("validates voice note schema", () => {
      const base64Audio = Buffer.from("fake-audio-bytes-for-test-recording").toString("base64");
      expect(
        voiceNoteSchema.safeParse({
          audioBase64: base64Audio,
          mimeType: "audio/webm",
          durationSec: 5,
        }).success,
      ).toBe(true);
      expect(voiceNoteSchema.safeParse({ audioBase64: "", mimeType: "text/plain", durationSec: 0 }).success).toBe(false);
    });

    it("validates reaction schema", () => {
      expect(reactionSchema.safeParse({ kind: "heart" }).success).toBe(true);
      expect(reactionSchema.safeParse({ kind: "take_care" }).success).toBe(true);
      expect(reactionSchema.safeParse({ kind: "invalid" }).success).toBe(false);
    });

    it("validates invite schema", () => {
      expect(inviteSchema.safeParse({ role: "FAMILY" }).success).toBe(true);
      expect(inviteSchema.safeParse({ role: "CARETAKER" }).success).toBe(true);
      expect(inviteSchema.safeParse({ role: "ELDER" }).success).toBe(false);
    });
  });
});
