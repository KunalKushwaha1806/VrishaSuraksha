"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { useDashboard } from "@/lib/client/useDashboard";
import type { ReactionKind } from "@/lib/models";
import { formatDateTime, formatTime } from "@/lib/time";
import { ClaimRefillButton, DoseStatusBadge } from "../shared";
import { Button, Card, ErrorState, LoadingState, Notice, PageHeader } from "../ui";
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
      <PageHeader title={`How ${elderFirst} is doing`} subtitle={data.circle.name} />

      <Card className="border-2 border-brand">
        <p className="text-2xl font-semibold">
          <span aria-hidden="true">🔥 </span>
          {data.streak > 0 ? `${data.streak} day streak of taking every medicine` : "A fresh streak starts today"}
        </p>
        {data.visibility.doses && data.today.length ? (
          <p className="mt-2 text-lg text-muted">
            Today: {takenToday} of {data.today.length} doses taken so far.
          </p>
        ) : null}
        {data.week.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Last 7 days">
            {data.week.map((w) => (
              <li key={w.day} className="rounded-xl bg-surface-2 px-3 py-2 text-center text-sm">
                <span className="block font-semibold">
                  {new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${w.day}T00:00:00Z`))}
                </span>
                {w.percent === null ? "–" : `${w.percent}%`}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">Cheer {elderFirst} on</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {REACTIONS.map((r) => (
            <Button key={r.kind} variant="secondary" size="lg" onClick={() => react(r.kind, r.label)}>
              <span aria-hidden="true">{r.icon}</span> {r.label}
            </Button>
          ))}
        </div>
        <div className="mt-3" aria-live="polite">
          {sent ? <Notice tone="ok">{sent}</Notice> : null}
          {sendError ? <Notice tone="danger">{sendError}</Notice> : null}
        </div>
      </Card>

      {data.visibility.stock ? (
        <Card>
          <h2 className="text-2xl font-bold">Refills you can help with</h2>
          {data.refills.length === 0 ? (
            <p className="mt-2 text-muted">Nothing is running low.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.refills.map((r) => (
                <li key={r.medicationId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{r.name}</strong>{" "}
                    {r.stock === 0 ? "has run out" : `runs out in about ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}`}
                  </span>
                  <ClaimRefillButton medicationId={r.medicationId} claimedByName={r.claimedByName} onDone={refresh} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-2xl font-bold">Record a voice reminder</h2>
        <p className="mt-1 text-muted">Your voice plays on {elderFirst}&apos;s screen when it is time for the medicine.</p>
        <div className="mt-4">
          <VoiceRecorder medications={data.medications.map((m) => ({ id: m.id, name: m.name }))} onSaved={refresh} />
        </div>
        {data.voiceNotes.length ? (
          <ul className="mt-4 space-y-1 text-muted">
            {data.voiceNotes.map((v) => (
              <li key={v.id}>
                Recorded {formatDateTime(v.createdAt)} · {v.playedAt ? "heard ✓" : "not heard yet"}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {data.visibility.doses && data.today.length ? (
        <Card>
          <h2 className="text-2xl font-bold">Today</h2>
          <ul className="mt-3 divide-y divide-line">
            {data.today.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {formatTime(d.scheduledFor)} · {d.medName}
                </span>
                <DoseStatusBadge status={d.status} reason={d.missedReason} />
              </li>
            ))}
          </ul>
          {!data.visibility.missedReasons ? (
            <p className="mt-3 text-sm text-muted">{elderFirst} keeps the reasons for missed doses private.</p>
          ) : null}
        </Card>
      ) : null}

      {data.visibility.appointments && data.appointments.length ? (
        <Card>
          <h2 className="text-2xl font-bold">Upcoming doctor visits</h2>
          <ul className="mt-3 space-y-2">
            {data.appointments.map((a) => (
              <li key={a.id}>
                <strong>{a.doctor}</strong> · {formatDateTime(a.startsAt)} · {a.place}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
