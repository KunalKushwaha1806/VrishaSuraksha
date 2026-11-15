"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { Button, Card, Notice } from "../ui";

/** Print button plus an optional Gemini summary (factual bullets only, no advice). */
export function BriefActions({ appointmentId, aiEnabled }: { appointmentId: string | null; aiEnabled: boolean }) {
  const [bullets, setBullets] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function summarise() {
    setBusy(true);
    setError(null);
    try {
      setBullets((await api<{ bullets: string[] }>("/api/brief", { body: { appointmentId } })).bullets);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap gap-2">
        <Button onClick={() => window.print()}>Print brief</Button>
        {aiEnabled && !bullets ? (
          <Button variant="secondary" onClick={summarise} disabled={busy}>
            {busy ? "Summarising…" : "Add AI summary"}
          </Button>
        ) : null}
      </div>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {bullets ? (
        <Card>
          <h2 className="text-xl font-bold">Summary</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">AI-generated from the logs below. Please check against the details.</p>
        </Card>
      ) : null}
    </div>
  );
}
