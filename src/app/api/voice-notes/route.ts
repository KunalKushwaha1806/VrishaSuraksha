import { route } from "@/lib/http";
import { listVoiceNotes, saveVoiceNote } from "@/lib/services/care";
import { voiceNoteSchema } from "@/lib/validation";
import { can } from "@/lib/domain/permissions";

export const GET = route({ permission: "voice:send" }, async ({ auth }) => {
  const notes = await listVoiceNotes(auth.circle.id);
  return {
    voiceNotes: can(auth.member.role, "voice:listen") ? notes : notes.filter((n) => n.fromMemberId === auth.member.id),
  };
});

/** A family member uploads a short (15 s max) voice reminder. Stored encrypted. */
export const POST = route(
  { permission: "voice:send", body: voiceNoteSchema, maxBytes: 600 * 1024, perMinute: 6 },
  async ({ auth, body }) => {
    const { audioEnc, ...meta } = await saveVoiceNote(auth.circle.id, auth.member, body);
    return { voiceNote: meta };
  },
);
