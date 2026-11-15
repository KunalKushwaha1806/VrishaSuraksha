"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { useDashboard } from "@/lib/client/useDashboard";
import type { ReactionKind } from "@/lib/models";
import { formatDateTime, formatTime } from "@/lib/time";
import { ClaimRefillButton, DoseStatusBadge } from "../shared";
import { Card, ErrorState, LoadingState, Notice, PageHeader } from "../ui";
import { VoiceRecorder } from "./VoiceRecorder";

const REACTIONS: Array<{ kind: ReactionKind; label: string; icon: string }> = [
  { kind: "heart", label: "Send a heart", icon: "❤️" },
  { kind: "proud", label: "Proud of you", icon: "🌟" },
  { kind: "love", label: "Sending love", icon: "🤗" },
  { kind: "call_soon", label: "Will call soon", icon: "📞" },
  { kind: "take_care", label: "Take care", icon: "🙏" },
];

/** Calm, read-mostly view for family. Positive progress first; no guilt feed. */
export function FamilyHome() {
  const { data, error, refresh } = useDashboard();
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return <LoadingState />;
  const elderFirst = data.elder.name.split(" ")[0];
  const takenToday = data.today.filter((d) => d.status === "TAKEN").length;

  async function react(kind: ReactionKind, label: string) {
    setSendError(null);
    try {
      await api("/api/reactions", { body: { kind } });
      setSent(`“${label}” sent to ${elderFirst}.`);
      await refresh();
    } catch (err) {
      setSendError(errorText(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`How ${elderFirst} is doing`} subtitle={`${data.circle.name} · Family Circle`} />

      {/* Streak Hero Card */}
      <Card className="relative overflow-hidden border-2 border-brand/40 bg-linear-to-br from-amber-500/10 via-brand/5 to-surface shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
              <span>🔥 Adherence Progress</span>
            </div>
            <p className="mt-2 text-2xl md:text-3xl font-extrabold text-ink tracking-tight">
              {data.streak > 0 ? (
                <>
                  <span className="text-brand">{data.streak} day streak</span> of taking every medicine!
                </>
              ) : (
                "A fresh streak starts today"
              )}
            </p>
            {data.visibility.doses && data.today.length ? (
              <p className="mt-1 text-base text-muted font-medium">
                Today: <strong className="text-ink">{takenToday}</strong> of {data.today.length} doses taken so far.
              </p>
            ) : null}
          </div>

          {data.streak > 0 && (
            <div className="flex items-center gap-2 self-start md:self-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-amber-800 dark:text-amber-300">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-xs uppercase font-bold tracking-wide">Keeping Dadaji healthy</p>
                <p className="text-sm font-semibold">Keep cheering him on!</p>
              </div>
            </div>
          )}
        </div>

        {data.week.length ? (
          <div className="mt-5 pt-4 border-t border-line/60">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Last 7 Days Completion</p>
            <ul className="flex flex-wrap gap-2" aria-label="Last 7 days">
              {data.week.map((w) => {
                const dayName = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(
                  new Date(`${w.day}T00:00:00Z`),
                );
                const isFull = w.percent === 100;
                return (
                  <li
                    key={w.day}
                    className={`flex-1 min-w-16 rounded-xl border p-2 text-center transition-all ${
                      isFull
                        ? "bg-ok-bg/70 border-ok/40 text-ok font-bold"
                        : w.percent !== null
                          ? "bg-surface-2 border-line text-ink"
                          : "bg-surface-2/40 border-line/40 text-muted"
                    }`}
                  >
                    <span className="block text-xs uppercase opacity-75">{dayName}</span>
                    <span className="block text-base font-extrabold mt-0.5">
                      {w.percent === null ? "–" : `${w.percent}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* Cheer Section */}
      <Card>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">💝</span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cheer {elderFirst} on</h2>
            <p className="text-sm text-muted">A quick reaction lights up his screen immediately</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {REACTIONS.map((r) => (
            <button
              key={r.kind}
              type="button"
              onClick={() => react(r.kind, r.label)}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-line bg-surface-2/60 hover:bg-brand/10 hover:border-brand/40 active:scale-95 transition-all text-center group cursor-pointer"
            >
              <span className="text-3xl group-hover:scale-125 transition-transform" aria-hidden="true">
                {r.icon}
              </span>
              <span className="text-xs font-bold text-ink group-hover:text-brand">{r.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-3" aria-live="polite">
          {sent ? <Notice tone="ok">{sent}</Notice> : null}
          {sendError ? <Notice tone="danger">{sendError}</Notice> : null}
        </div>
      </Card>

      {/* Refills */}
      {data.visibility.stock ? (
        <Card>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💊</span>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Refills you can help with</h2>
              <p className="text-sm text-muted">Claim a medicine refill to let the family know it is taken care of</p>
            </div>
          </div>

          {data.refills.length === 0 ? (
            <div className="mt-4 rounded-xl bg-surface-2/40 border border-line/40 p-4 text-center text-muted">
              ✓ All medicines have plenty of stock. Nothing is running low.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.refills.map((r) => (
                <li
                  key={r.medicationId}
                  className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-base text-ink">{r.name}</p>
                    <p className="text-sm text-danger font-semibold">
                      {r.stock === 0
                        ? "⚠️ Out of stock"
                        : `⚠️ Runs out in about ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <ClaimRefillButton medicationId={r.medicationId} claimedByName={r.claimedByName} onDone={refresh} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* Voice Reminders */}
      <Card>
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎙️</span>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Record a voice reminder</h2>
            <p className="text-sm text-muted">
              Your voice will play automatically on {elderFirst}&apos;s screen when this dose is due.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <VoiceRecorder medications={data.medications.map((m) => ({ id: m.id, name: m.name }))} onSaved={refresh} />
        </div>

        {data.voiceNotes.length ? (
          <div className="mt-5 pt-4 border-t border-line/60">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Previously Recorded Notes</p>
            <ul className="space-y-2">
              {data.voiceNotes.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-line/60 bg-surface text-sm"
                >
                  <span className="font-medium text-ink">Recorded on {formatDateTime(v.createdAt)}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                      v.playedAt ? "bg-ok-bg text-ok" : "bg-surface-2 text-muted"
                    }`}
                  >
                    {v.playedAt ? "✓ Heard by Dadaji" : "Pending playback"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* Today's Schedule */}
      {data.visibility.doses && data.today.length ? (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-2xl font-bold tracking-tight">Today&apos;s Schedule</h2>
            <span className="text-xs font-bold text-muted uppercase bg-surface-2 px-2.5 py-1 rounded-full">
              {takenToday} / {data.today.length} Taken
            </span>
          </div>

          <ul className="divide-y divide-line/60">
            {data.today.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold bg-surface-2 px-2 py-1 rounded-md text-muted">
                    {formatTime(d.scheduledFor)}
                  </span>
                  <span className="font-semibold text-ink">{d.medName}</span>
                </div>
                <DoseStatusBadge status={d.status} reason={d.missedReason} />
              </li>
            ))}
          </ul>
          {!data.visibility.missedReasons ? (
            <p className="mt-3 text-xs text-muted/80 italic">
              🔒 {elderFirst} has chosen to keep reasons for missed doses private.
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Upcoming Appointments */}
      {data.visibility.appointments && data.appointments.length ? (
        <Card>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-2xl">🩺</span>
            <h2 className="text-2xl font-bold tracking-tight">Upcoming Doctor Visits</h2>
          </div>
          <ul className="space-y-3">
            {data.appointments.map((a) => (
              <li key={a.id} className="p-3.5 rounded-xl border border-line bg-surface-2/40 space-y-1">
                <p className="font-bold text-base text-ink">{a.doctor}</p>
                <p className="text-sm text-muted">
                  🗓️ {formatDateTime(a.startsAt)} · 📍 {a.place}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
