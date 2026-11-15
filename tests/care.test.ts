import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import { C } from "@/lib/models";
import {
  addReaction,
  addSymptomNote,
  appointmentView,
  claimRefill,
  deleteAppointment,
  deleteVoiceNote,
  listAppointments,
  listSymptoms,
  listVoiceNotes,
  readVoiceNote,
  recentReactions,
  saveAppointment,
  saveVoiceNote,
} from "@/lib/services/care";

describe("Care Services", () => {
  it("creates, lists, views, and deletes appointments with encrypted notes", async () => {
    const { circle, caretaker } = await harness();

    const appt = await saveAppointment(circle.id, caretaker, {
      doctor: "Dr. A. Verma",
      place: "Apollo Delhi",
      startsAt: "2026-11-20T10:30:00.000Z",
      notes: "Strictly fasting before test",
      reminderOffsetsMin: [60],
    });

    expect(appt.id).toBeDefined();
    expect(appt.notesEnc).not.toContain("Strictly fasting"); // Encrypted at rest

    const view = appointmentView(appt);
    expect(view.notes).toBe("Strictly fasting before test"); // Decrypted for authorized views

    const list = await listAppointments(circle.id);
    expect(list.length).toBe(1);
    expect(list[0].doctor).toBe("Dr. A. Verma");

    await deleteAppointment(circle.id, caretaker, appt.id);
    const afterDelete = await listAppointments(circle.id);
    expect(afterDelete.length).toBe(0);
  });

  it("logs, retrieves, and decrypts symptoms", async () => {
    const { circle, elder } = await harness();

    const symptom = await addSymptomNote(circle.id, elder, {
      kind: "side_effect",
      text: "Felt mild headache after afternoon walk",
    });

    expect(symptom.id).toBeDefined();
    expect(symptom.textEnc).not.toContain("headache");

    const list = await listSymptoms(circle.id);
    expect(list.length).toBe(1);
    expect(list[0].text).toBe("Felt mild headache after afternoon walk");
  });

  it("stores, retrieves, and deletes voice notes", async () => {
    const { circle, family } = await harness();

    const audioBase64 = Buffer.from("test-voice-data").toString("base64");
    const note = await saveVoiceNote(circle.id, family, {
      audioBase64,
      mimeType: "audio/webm",
      durationSec: 3,
      medicationId: null,
    });

    expect(note.id).toBeDefined();
    expect(note.durationSec).toBe(3);

    const voiceData = await readVoiceNote(circle.id, note.id);
    expect(voiceData).toBeDefined();
    expect(voiceData.mimeType).toBe("audio/webm");
    expect(voiceData.audio.toString()).toBe("test-voice-data");

    const list = await listVoiceNotes(circle.id);
    expect(list.length).toBe(1);

    await deleteVoiceNote(circle.id, family, note.id);
    expect((await listVoiceNotes(circle.id)).length).toBe(0);
  });

  it("records cheer reactions and retrieves recent reactions", async () => {
    const { circle, family } = await harness();

    const reaction = await addReaction(circle.id, family, "heart");
    expect(reaction.kind).toBe("heart");
    expect(reaction.fromMemberId).toBe(family.id);

    const list = await recentReactions(circle.id);
    expect(list.length).toBe(1);
    expect(list[0].kind).toBe("heart");
  });

  it("claims a medication refill atomically", async () => {
    const { db, circle, family } = await harness();
    const med = {
      id: "med-456",
      circleId: circle.id,
      name: "Metformin",
      doseText: "500 mg",
      form: "tablet" as const,
      criticality: "normal" as const,
      stock: 0,
      unitsPerDose: 1,
      notesEnc: null,
      active: true,
      explanations: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      schedule: { times: ["09:00"], days: [0, 1, 2, 3, 4, 5, 6], startDate: "2026-01-01", endDate: null },
    };
    await db.set(C.medications(circle.id), med.id, med);

    const claim = await claimRefill(circle.id, family, "med-456");
    expect(claim.medicationId).toBe("med-456");
    expect(claim.claimedById).toBe(family.id);
  });
});
