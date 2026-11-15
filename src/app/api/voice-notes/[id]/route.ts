import { NextResponse } from "next/server";
import { can } from "@/lib/domain/permissions";
import { getDb } from "@/lib/db";
import { fail, route } from "@/lib/http";
import { C, type VoiceNote } from "@/lib/models";
import { deleteVoiceNote, markVoiceNotePlayed, readVoiceNote } from "@/lib/services/care";

/** Streams the decrypted audio to the elder, caretakers, or the member who recorded it. */
export const GET = route({ permission: "voice:send" }, async ({ auth, params }) => {
  const db = await getDb();
  const note = await db.get<VoiceNote>(C.voiceNotes(auth.circle.id), params.id);
  if (!note) throw fail.notFound();
  if (!can(auth.member.role, "voice:listen") && note.fromMemberId !== auth.member.id) throw fail.forbidden();
  const { audio, mimeType } = await readVoiceNote(auth.circle.id, params.id);
  if (auth.member.role === "ELDER" && !note.playedAt) await markVoiceNotePlayed(auth.circle.id, params.id);
  return new NextResponse(new Uint8Array(audio), {
    headers: { "Content-Type": mimeType, "Cache-Control": "private, no-store", "Content-Length": String(audio.length) },
  });
});

export const DELETE = route({ permission: "voice:send" }, async ({ auth, params }) => {
  await deleteVoiceNote(auth.circle.id, auth.member, params.id);
  return { ok: true };
});
