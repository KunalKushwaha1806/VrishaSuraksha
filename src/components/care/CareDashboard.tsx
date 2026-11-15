"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiClientError, errorText } from "@/lib/client/api";
import { useDashboard } from "@/lib/client/useDashboard";
import type { MissedReason } from "@/lib/models";
import type { Dashboard } from "@/lib/services/dashboard";
import { formatDateTime, formatTime } from "@/lib/time";
import { ClaimRefillButton, DoseStatusBadge, PercentBar, REASON_LABEL } from "../shared";
import { Button, Card, EmptyState, ErrorState, LinkButton, LoadingState, Notice, PageHeader } from "../ui";

type Dose = Dashboard["today"][number];

/** Caretaker logs on the elder's behalf, always with an audit note. */
function LogOnBehalf({ dose, onDone }: { dose: Dose; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDouble, setConfirmDouble] = useState(false);

  async function submit(status: "TAKEN" | "SKIPPED" | "MISSED", reason?: MissedReason) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/doses/${encodeURIComponent(dose.id)}`, {
        body: { status, reason, note: note || "Logged by caretaker", confirmDouble: confirmDouble || undefined },
      });
      setOpen(false);
      onDone();
    } catch (err) {
      if (err instanceof ApiClientError && err.details.reason === "double_dose") {
        setConfirmDouble(true);
        setError("This medicine was already taken a short while ago. Press “Taken” again only if you are sure.");
      } else setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        aria-label={`Log ${dose.medName} at ${formatTime(dose.scheduledFor)}`}
      >
        Log
      </Button>
    );
  }
  return (
    <div className="mt-3 w-full space-y-3 rounded-2xl bg-surface-2 p-4">
      <label htmlFor={`note-${dose.id}`} className="block font-semibold">
        Audit note
      </label>
      <input
        id={`note-${dose.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="e.g. Gave it with breakfast"
        className="block min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3"
      />
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => submit("TAKEN")}>
          Taken
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => submit("SKIPPED")}>
          Skipped
        </Button>
        {(Object.keys(REASON_LABEL) as MissedReason[]).map((r) => (
          <Button key={r} variant="secondary" disabled={busy} onClick={() => submit("MISSED", r)}>
            Missed: {REASON_LABEL[r]}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function CareDashboard() {
  const { data, error, refresh } = useDashboard();
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return <LoadingState />;
  const a = data.adherence;
  const taken = data.today.filter((d) => d.status === "TAKEN").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Caring for ${data.elder.name}`}
        subtitle={`Circle code ${data.circle.code} · Updates every 30 seconds`}
        actions={
          <>
            <LinkButton href="/app/scan">Scan prescription</LinkButton>
            <LinkButton href="/app/medicines?new=1" variant="secondary">
              Add medicine
            </LinkButton>
          </>
        }
      />

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Doses Today</p>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-ink">
            {taken} <span className="text-sm font-semibold text-muted">/ {data.today.length}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">7-Day Adherence</p>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-emerald-600">
            {a?.week?.percent !== null ? `${a?.week?.percent}%` : "100%"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Active Streak</p>
          <p className="mt-1 text-2xl sm:text-3xl font-black text-amber-600">
            🔥 {data.streak} <span className="text-sm font-semibold text-muted">days</span>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Refill Alerts</p>
          <p
            className={`mt-1 text-2xl sm:text-3xl font-black ${data.refills.length > 0 ? "text-amber-600" : "text-ink"}`}
          >
            {data.refills.length > 0 ? `⚠️ ${data.refills.length}` : "0 low"}
          </p>
        </div>
      </div>

      {data.failedJobs > 0 ? (
        <Notice tone="danger" title="Some reminders could not be sent">
          {data.failedJobs} email reminder(s) failed after 3 attempts. Check the email settings.
        </Notice>
      ) : null}

      <section aria-labelledby="alerts" className="grid gap-4 md:grid-cols-2">
        <h2 id="alerts" className="sr-only">
          Alerts
        </h2>
        <Card>
          <h3 className="text-xl font-bold">Missed doses (last 2 days)</h3>
          {data.recentMissed.length === 0 ? (
            <p className="mt-2 text-muted">None. Lovely.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentMissed.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{m.medName}</strong> · {formatDateTime(m.scheduledFor)}
                  </span>
                  <DoseStatusBadge status="MISSED" reason={m.missedReason} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h3 className="text-xl font-bold">Refills needed soon</h3>
          {data.refills.length === 0 ? (
            <p className="mt-2 text-muted">Every medicine has more than 5 days left.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.refills.map((r) => (
                <li key={r.medicationId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{r.name}</strong> ·{" "}
                    {r.stock === 0 ? "run out" : `${r.stock} left (${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"})`}
                  </span>
                  <ClaimRefillButton medicationId={r.medicationId} claimedByName={r.claimedByName} onDone={refresh} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section aria-labelledby="today-doses">
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="today-doses" className="text-2xl font-bold">
              Today&apos;s doses
            </h2>
            <p className="text-muted" aria-live="polite">
              {taken} of {data.today.length} taken
            </p>
          </div>
          {data.today.length === 0 ? (
            <EmptyState
              title="No doses scheduled today"
              action={<LinkButton href="/app/medicines?new=1">Add a medicine</LinkButton>}
            />
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {data.today.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">
                      {formatTime(d.scheduledFor)} · {d.medName}{" "}
                      <span className="font-normal text-muted">{d.doseText}</span>
                    </p>
                    {d.loggedByName ? <p className="text-sm text-muted">Logged by {d.loggedByName}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <DoseStatusBadge status={d.status} reason={d.missedReason} />
                    {d.status === "PENDING" || d.status === "MISSED" ? <LogOnBehalf dose={d} onDone={refresh} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {a ? (
        <section aria-labelledby="adherence" className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3">
            <h2 id="adherence" className="text-2xl font-bold">
              Adherence
            </h2>
            <PercentBar label="Today" percent={a.today.percent} />
            <PercentBar label="Last 7 days" percent={a.week.percent} />
            <PercentBar label="Last 30 days" percent={a.month.percent} />
            <p className="text-sm text-muted">
              Streak: {data.streak} day(s). Skipped doses are the elder&apos;s informed choice and don&apos;t count
              against them.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="text-2xl font-bold">By medicine (7 days)</h2>
            {a.byMedication.map((m) => (
              <PercentBar key={m.medicationId} label={m.name} percent={m.percent} />
            ))}
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="visits">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="visits" className="text-2xl font-bold">
              Upcoming doctor visits
            </h2>
            <LinkButton href="/app/appointments" variant="secondary">
              Manage visits
            </LinkButton>
          </div>
          {data.appointments.length === 0 ? (
            <p className="mt-2 text-muted">No visits scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.appointments.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <strong>{v.doctor}</strong> · {formatDateTime(v.startsAt)} · {v.place}
                  </span>
                  <Link
                    className="font-semibold text-brand underline"
                    href={`/app/brief?appointment=${encodeURIComponent(v.id)}`}
                  >
                    Doctor brief
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
