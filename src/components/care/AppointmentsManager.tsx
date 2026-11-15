"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorText, fieldErrors } from "@/lib/client/api";
import { formatDateTime } from "@/lib/time";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Notice, PageHeader, TextArea } from "../ui";

interface Appt {
  id: string;
  doctor: string;
  place: string;
  startsAt: string;
  notes: string | null;
  reminderOffsetsMin: number[];
}

/** "YYYY-MM-DDTHH:MM" in India time for a datetime-local input. */
function toLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  return d.toISOString().slice(0, 16);
}

function AppointmentForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Appt | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const offsets = [f.remind24 ? 24 * 60 : null, f.remind2 ? 120 : null].filter((v): v is number => v !== null);
    setBusy(true);
    setError(null);
    try {
      await api(initial ? `/api/appointments/${encodeURIComponent(initial.id)}` : "/api/appointments", {
        method: initial ? "PUT" : "POST",
        body: {
          doctor: f.doctor,
          place: f.place,
          startsAt: f.startsAt ? `${f.startsAt}:00+05:30` : "",
          notes: f.notes,
          reminderOffsetsMin: offsets,
        },
      });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setFields(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-2xl font-bold">{initial ? "Edit visit" : "Add a doctor visit"}</h2>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
        {error ? (
          <div className="md:col-span-2">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}
        <Field id="doctor" name="doctor" label="Doctor" defaultValue={initial?.doctor} required error={fields.doctor} />
        <Field id="place" name="place" label="Place" defaultValue={initial?.place} required error={fields.place} />
        <Field
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          label="Date and time (India time)"
          defaultValue={initial ? toLocalInput(initial.startsAt) : ""}
          required
          error={fields.startsAt}
        />
        <fieldset>
          <legend className="text-base font-semibold">Email reminders</legend>
          <label className="mt-2 flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              name="remind24"
              className="h-5 w-5"
              defaultChecked={initial ? initial.reminderOffsetsMin.includes(1440) : true}
            />
            One day before
          </label>
          <label className="flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              name="remind2"
              className="h-5 w-5"
              defaultChecked={initial ? initial.reminderOffsetsMin.includes(120) : true}
            />
            Two hours before
          </label>
        </fieldset>
        <div className="md:col-span-2">
          <TextArea
            id="notes"
            name="notes"
            label="Notes (kept encrypted)"
            defaultValue={initial?.notes ?? ""}
            maxLength={500}
          />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save visit"}
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function AppointmentsManager({ canEdit, canBrief }: { canEdit: boolean; canBrief: boolean }) {
  const [items, setItems] = useState<Appt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Appt | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ appointments: Appt[] }>("/api/appointments")).appointments);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(a: Appt) {
    if (!window.confirm(`Remove the visit with ${a.doctor}?`)) return;
    await api(`/api/appointments/${encodeURIComponent(a.id)}`, { method: "DELETE" }).catch((err) =>
      setError(errorText(err)),
    );
    await load();
  }

  if (error && !items) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <LoadingState />;
  const now = new Date().toISOString();
  const upcoming = items.filter((a) => a.startsAt >= now);
  const past = items.filter((a) => a.startsAt < now).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor visits"
        subtitle="Everyone allowed is emailed a reminder before each visit."
        actions={canEdit && !editing ? <Button onClick={() => setEditing("new")}>Add visit</Button> : null}
      />
      {editing ? (
        <AppointmentForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      {upcoming.length === 0 ? (
        <EmptyState
          title="No upcoming visits"
          action={canEdit ? <Button onClick={() => setEditing("new")}>Add a visit</Button> : null}
        />
      ) : (
        <ul className="space-y-3">
          {upcoming.map((a) => (
            <li key={a.id}>
              <Card className="space-y-1">
                <h2 className="text-2xl font-bold">{a.doctor}</h2>
                <p className="text-lg">{formatDateTime(a.startsAt)}</p>
                <p className="text-muted">{a.place}</p>
                {a.notes ? <p>{a.notes}</p> : null}
                <div className="flex flex-wrap gap-2 pt-2">
                  {canBrief ? (
                    <Link
                      className="inline-flex min-h-12 items-center font-semibold text-brand underline"
                      href={`/app/brief?appointment=${encodeURIComponent(a.id)}`}
                    >
                      Prepare doctor brief
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <>
                      <Button variant="secondary" onClick={() => setEditing(a)}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => remove(a)}>
                        Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {past.length ? (
        <details className="rounded-2xl border border-line p-4">
          <summary className="cursor-pointer font-semibold">Past visits ({past.length})</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {past.map((a) => (
              <li key={a.id}>
                {a.doctor} · {formatDateTime(a.startsAt)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
