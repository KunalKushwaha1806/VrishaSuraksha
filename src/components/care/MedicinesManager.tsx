"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorText, fieldErrors } from "@/lib/client/api";
import type { Criticality, Schedule } from "@/lib/models";
import { istDayKey } from "@/lib/time";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Notice,
  PageHeader,
  SelectField,
  TextArea,
} from "../ui";

interface MedView {
  id: string;
  name: string;
  doseText: string;
  form: string;
  criticality: Criticality;
  stock: number | null;
  unitsPerDose: number;
  notes: string | null;
  schedule: Schedule;
  forecast: { daysLeft: number | null; runOutDay: string | null; needsRefill: boolean } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CRIT_LABEL: Record<Criticality, string> = { high: "High priority", normal: "Normal", low: "Low priority" };

function MedicineForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: MedView | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<string[]>(initial?.schedule.times ?? ["09:00"]);
  const [days, setDays] = useState<number[]>(initial?.schedule.days ?? [0, 1, 2, 3, 4, 5, 6]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = {
      name: f.name,
      doseText: f.doseText,
      form: f.form,
      criticality: f.criticality,
      stock: Number(f.stock),
      unitsPerDose: Number(f.unitsPerDose),
      notes: f.notes,
      schedule: { times: times.filter(Boolean), days, startDate: f.startDate, endDate: f.endDate || null },
    };
    setBusy(true);
    setError(null);
    try {
      await api(initial ? `/api/medications/${encodeURIComponent(initial.id)}` : "/api/medications", {
        method: initial ? "PATCH" : "POST",
        body,
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
      <h2 className="mb-4 text-2xl font-bold">{initial ? `Edit ${initial.name}` : "Add a medicine"}</h2>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
        {error ? (
          <div className="md:col-span-2">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}
        <Field id="name" name="name" label="Medicine name" defaultValue={initial?.name} required error={fields.name} />
        <Field
          id="doseText"
          name="doseText"
          label="Strength / dose"
          placeholder="e.g. 500 mg"
          defaultValue={initial?.doseText}
          required
          error={fields.doseText}
        />
        <SelectField id="form" name="form" label="Form" defaultValue={initial?.form ?? "tablet"}>
          {["tablet", "capsule", "syrup", "injection", "drops", "inhaler", "other"].map((v) => (
            <option key={v} value={v}>
              {v[0].toUpperCase() + v.slice(1)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="criticality"
          name="criticality"
          label="How important is it not to miss?"
          defaultValue={initial?.criticality ?? "normal"}
        >
          <option value="high">High: alert caretaker and family quickly</option>
          <option value="normal">Normal</option>
          <option value="low">Low: gentle reminders, family not alerted</option>
        </SelectField>
        <Field
          id="stock"
          name="stock"
          type="number"
          min={0}
          label="Units in stock"
          defaultValue={initial?.stock ?? 30}
          required
          error={fields.stock}
        />
        <Field
          id="unitsPerDose"
          name="unitsPerDose"
          type="number"
          min={0.25}
          step={0.25}
          label="Units per dose"
          defaultValue={initial?.unitsPerDose ?? 1}
          required
          error={fields.unitsPerDose}
        />

        <fieldset className="md:col-span-2">
          <legend className="text-base font-semibold">Times of day (India time)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {times.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <label htmlFor={`time-${i}`} className="sr-only">
                  Time {i + 1}
                </label>
                <input
                  id={`time-${i}`}
                  type="time"
                  value={t}
                  onChange={(e) => setTimes((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  className="min-h-12 rounded-xl border-2 border-line bg-surface px-3 text-lg"
                />
                {times.length > 1 ? (
                  <Button
                    variant="ghost"
                    aria-label={`Remove time ${i + 1}`}
                    onClick={() => setTimes((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </Button>
                ) : null}
              </span>
            ))}
            {times.length < 8 ? (
              <Button variant="secondary" onClick={() => setTimes((prev) => [...prev, "21:00"])}>
                + Add time
              </Button>
            ) : null}
          </div>
          {fields["schedule.times"] ? (
            <p className="mt-1 text-sm font-semibold text-danger">{fields["schedule.times"]}</p>
          ) : null}
        </fieldset>

        <fieldset className="md:col-span-2">
          <legend className="text-base font-semibold">Days</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAYS.map((label, i) => (
              <label
                key={label}
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 border-line px-3"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={days.includes(i)}
                  onChange={(e) =>
                    setDays((prev) => (e.target.checked ? [...prev, i].sort() : prev.filter((d) => d !== i)))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {fields["schedule.days"] ? (
            <p className="mt-1 text-sm font-semibold text-danger">{fields["schedule.days"]}</p>
          ) : null}
        </fieldset>

        <Field
          id="startDate"
          name="startDate"
          type="date"
          label="Start date"
          defaultValue={initial?.schedule.startDate ?? istDayKey(new Date())}
          required
        />
        <Field
          id="endDate"
          name="endDate"
          type="date"
          label="End date (optional)"
          defaultValue={initial?.schedule.endDate ?? ""}
        />
        <div className="md:col-span-2">
          <TextArea
            id="notes"
            name="notes"
            label="Notes (kept encrypted)"
            defaultValue={initial?.notes ?? ""}
            maxLength={500}
          />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save medicine"}
          </Button>
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function MedicinesManager({ canEdit }: { canEdit: boolean }) {
  const params = useSearchParams();
  const [meds, setMeds] = useState<MedView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MedView | "new" | null>(params.get("new") && canEdit ? "new" : null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ medications: MedView[] }>("/api/medications");
      setMeds(res.medications);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function stop(med: MedView) {
    if (!window.confirm(`Stop ${med.name}? Its history is kept and future reminders are removed.`)) return;
    try {
      await api(`/api/medications/${encodeURIComponent(med.id)}`, { method: "DELETE" });
      setNotice(`${med.name} stopped.`);
      await load();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  async function restock(med: MedView, add: number) {
    try {
      await api(`/api/medications/${encodeURIComponent(med.id)}`, {
        method: "PATCH",
        body: { stock: (med.stock ?? 0) + add },
      });
      setNotice(`Added ${add} to ${med.name}.`);
      await load();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  if (error && !meds) return <ErrorState message={error} onRetry={load} />;
  if (!meds) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicines"
        subtitle="Schedules use India time. Reminders follow each medicine's priority."
        actions={canEdit && editing === null ? <Button onClick={() => setEditing("new")}>Add medicine</Button> : null}
      />
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {editing ? (
        <MedicineForm
          initial={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Saved. Reminders have been updated.");
            void load();
          }}
        />
      ) : null}
      {meds.length === 0 ? (
        <EmptyState
          title="No medicines yet"
          action={canEdit ? <Button onClick={() => setEditing("new")}>Add the first medicine</Button> : null}
        >
          {canEdit ? "Add one by hand, or scan a prescription." : "The caretaker has not added any medicines yet."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {meds.map((m) => (
            <li key={m.id}>
              <Card className="h-full space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-2xl font-bold">
                    {m.name} <span className="text-lg font-normal text-muted">{m.doseText}</span>
                  </h2>
                  <Badge tone={m.criticality === "high" ? "warn" : "info"}>{CRIT_LABEL[m.criticality]}</Badge>
                </div>
                <p>
                  {m.schedule.times.join(", ")} ·{" "}
                  {m.schedule.days.length === 7 ? "every day" : m.schedule.days.map((d) => DAYS[d]).join(", ")}
                </p>
                {m.stock !== null ? (
                  <p>
                    {m.stock} in stock
                    {m.forecast?.daysLeft !== null && m.forecast
                      ? ` · about ${m.forecast.daysLeft} day(s) left`
                      : ""}{" "}
                    {m.forecast?.needsRefill ? <Badge tone="warn">Refill soon</Badge> : null}
                  </p>
                ) : null}
                {m.notes ? <p className="text-muted">{m.notes}</p> : null}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => restock(m, 30)}>
                      +30 restocked
                    </Button>
                    <Button variant="ghost" onClick={() => stop(m)}>
                      Stop
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
