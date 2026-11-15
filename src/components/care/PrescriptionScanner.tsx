"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import type { DiffItem } from "@/lib/domain/prescription";
import { Badge, Button, Card, Notice, PageHeader } from "../ui";

const MAX_EDGE = 1600;

/** Resizes and re-encodes the photo in the browser so only a small JPEG is uploaded. */
async function resizeImage(file: File): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg" };
}

const KIND_TONE = { added: "ok", changed: "warn", stopped: "danger", unchanged: "info" } as const;
const KIND_LABEL = {
  added: "New",
  changed: "Changed",
  stopped: "Not on this prescription",
  unchanged: "No change",
} as const;

interface Row {
  item: DiffItem;
  selected: boolean;
  doseText: string;
  times: string;
}

export function PrescriptionScanner() {
  const [state, setState] = useState<"idle" | "reading" | "review" | "applying" | "done">("idle");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(0);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setState("reading");
    try {
      const { base64, mimeType } = await resizeImage(file);
      const res = await api<{ diff: DiffItem[] }>("/api/prescriptions/scan", {
        body: { imageBase64: base64, mimeType },
      });
      setRows(
        res.diff.map((item) => ({
          item,
          // Additions and changes are pre-selected; stopping a medicine must be an explicit choice.
          selected: item.kind === "added" || item.kind === "changed",
          doseText: item.after?.doseText ?? item.before?.doseText ?? "",
          times: (item.after?.times ?? item.before?.times ?? []).join(", "),
        })),
      );
      setState("review");
    } catch (err) {
      setError(errorText(err));
      setState("idle");
    }
  }

  async function apply() {
    const chosen = rows.filter((r) => r.selected && r.item.kind !== "unchanged");
    if (!chosen.length) return;
    setState("applying");
    setError(null);
    try {
      const items = chosen.map((r) => {
        const times = r.times
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (r.item.kind === "added") {
          return {
            kind: "added",
            name: r.item.name,
            doseText: r.doseText || "As prescribed",
            times,
            durationDays: r.item.after?.durationDays ?? null,
            stock: 0,
          };
        }
        if (r.item.kind === "changed")
          return { kind: "changed", medicationId: r.item.medicationId, doseText: r.doseText, times };
        return { kind: "stopped", medicationId: r.item.medicationId };
      });
      const res = await api<{ applied: number }>("/api/prescriptions/apply", { body: { items } });
      setApplied(res.applied);
      setState("done");
    } catch (err) {
      setError(errorText(err));
      setState("review");
    }
  }

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescription change detector"
        subtitle="Photograph a new prescription. Gemini reads it; you confirm every change. The photo is never stored."
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {state === "idle" || state === "reading" ? (
        <Card>
          <label htmlFor="rx-photo" className="block text-xl font-semibold">
            Prescription photo
          </label>
          <p className="text-muted">Take a clear, flat photo in good light.</p>
          <input
            id="rx-photo"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={state === "reading"}
            onChange={(e) => onFile(e.target.files?.[0])}
            className="mt-3 block w-full min-h-12 rounded-xl border-2 border-line bg-surface p-2 text-lg"
          />
          {state === "reading" ? (
            <p role="status" className="mt-3 font-semibold">
              Reading the prescription…
            </p>
          ) : null}
        </Card>
      ) : null}

      {state === "review" || state === "applying" ? (
        <Card>
          <h2 className="text-2xl font-bold">Review the changes</h2>
          <p className="mt-1 text-muted">
            AI can misread handwriting. Check each line against the paper before applying.
          </p>
          {rows.length === 0 ? <p className="mt-4">No medicines were found in that photo.</p> : null}
          <ul className="mt-4 space-y-4">
            {rows.map((r, i) => (
              <li key={`${r.item.kind}-${r.item.name}`} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xl font-bold">{r.item.name}</p>
                  <Badge tone={KIND_TONE[r.item.kind]}>{KIND_LABEL[r.item.kind]}</Badge>
                </div>
                {r.item.before ? (
                  <p className="text-muted">
                    Now: {r.item.before.doseText} at {r.item.before.times.join(", ")}
                  </p>
                ) : null}
                {r.item.after?.instructions ? (
                  <p className="text-muted">Instructions: {r.item.after.instructions}</p>
                ) : null}
                {r.item.kind === "added" || r.item.kind === "changed" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`dose-${i}`} className="font-semibold">
                        Dose
                      </label>
                      <input
                        id={`dose-${i}`}
                        value={r.doseText}
                        onChange={(e) => update(i, { doseText: e.target.value })}
                        className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3"
                      />
                    </div>
                    <div>
                      <label htmlFor={`times-${i}`} className="font-semibold">
                        Times (HH:MM, comma separated)
                      </label>
                      <input
                        id={`times-${i}`}
                        value={r.times}
                        onChange={(e) => update(i, { times: e.target.value })}
                        className="mt-1 block min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3"
                      />
                    </div>
                  </div>
                ) : null}
                {r.item.kind !== "unchanged" ? (
                  <label className="mt-3 flex min-h-12 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={r.selected}
                      onChange={(e) => update(i, { selected: e.target.checked })}
                    />
                    {r.item.kind === "stopped" ? "Stop this medicine" : "Apply this change"}
                  </label>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="lg"
              onClick={apply}
              disabled={state === "applying" || !rows.some((r) => r.selected && r.item.kind !== "unchanged")}
            >
              {state === "applying" ? "Applying…" : "Confirm and apply"}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setState("idle")}>
              Start over
            </Button>
          </div>
        </Card>
      ) : null}

      {state === "done" ? (
        <Notice tone="ok" title={`${applied} change(s) applied`}>
          Reminders have been updated.{" "}
          <Link href="/app/medicines" className="font-semibold underline">
            Review medicines
          </Link>{" "}
          to set stock for new ones.
        </Notice>
      ) : null}
    </div>
  );
}
