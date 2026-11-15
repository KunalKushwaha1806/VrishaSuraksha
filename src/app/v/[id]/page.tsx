import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { C, type VoiceNote, type Medication, type Circle } from "@/lib/models";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Family Voice Note · VridhaSuraksha",
  robots: { index: false, follow: false },
};

export default async function VoicePlaybackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();

  // Find the voice note across circles
  const circles = await db.query<Circle>(C.circles);
  let note: VoiceNote | null = null;
  let circleName = "";
  let medName = "";

  for (const c of circles) {
    const found = await db.get<VoiceNote>(C.voiceNotes(c.id), id);
    if (found) {
      note = found;
      circleName = c.name;
      if (found.medicationId) {
        const med = await db.get<Medication>(C.medications(c.id), found.medicationId);
        if (med) medName = med.name;
      }
      break;
    }
  }

  if (!note) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <p className="text-sm font-semibold text-brand">VridhaSuraksha</p>
        <h1 className="mt-3 text-2xl font-bold">Voice Note Not Found</h1>
        <p className="mt-3 text-muted-foreground">This voice reminder may have been removed or expired.</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand/90"
        >
          Open App
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12 text-center">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-8 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
          VridhaSuraksha · {circleName ? `${circleName} · ` : ""}Family Voice Reminder
        </p>
        <div className="mt-4 text-5xl">🎙️</div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">
          Voice Note from {note.fromName}
        </h1>
        {medName ? (
          <p className="mt-2 text-lg font-medium text-brand">
            For: {medName}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted-foreground">
          Recorded on {formatDateTime(note.createdAt)} ({note.durationSec}s)
        </p>

        <div className="mt-8 flex flex-col items-center justify-center">
          <audio
            controls
            autoPlay
            src={`/api/voice-notes/${note.id}`}
            className="w-full max-w-md"
          >
            <track kind="captions" />
            Your browser does not support audio playback.
          </audio>
        </div>

        <div className="mt-8 pt-6 border-t border-amber-200/60 dark:border-amber-900/40">
          <Link
            href="/login"
            className="inline-block rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand/90"
          >
            Open VridhaSuraksha
          </Link>
        </div>
      </div>
    </main>
  );
}
