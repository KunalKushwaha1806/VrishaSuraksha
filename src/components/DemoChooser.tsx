"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { Button, Notice } from "./ui";

const PEOPLE = [
  { key: "elder", role: "ELDER", label: "Dadaji (Ramesh)", detail: "The elder. Large text, Hindi, voice-friendly." },
  { key: "caretaker", role: "CARETAKER", label: "Sunita", detail: "Caretaker. Manages medicines, visits and prescriptions." },
  { key: "riya", role: "FAMILY", member: "riya", label: "Riya", detail: "Granddaughter. Sends hearts and voice reminders." },
  { key: "arjun", role: "FAMILY", member: "arjun", label: "Arjun", detail: "Son. Handles refills; can see missed-dose reasons." },
] as const;

export function DemoChooser() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  async function enter(person: (typeof PEOPLE)[number]) {
    setBusy(person.key);
    setError(null);
    try {
      await api("/api/demo", { body: { role: person.role, member: "member" in person ? person.member : undefined } });
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    setError(null);
    try {
      await api("/api/demo/reset", { body: {} });
      setResetDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {resetDone ? <Notice tone="ok">The demo has been reset to its starting story.</Notice> : null}
      <ul className="space-y-3">
        {PEOPLE.map((p) => (
          <li key={p.key}>
            <Button
              variant="secondary"
              size="lg"
              className="w-full flex-col !items-start py-3 text-left"
              disabled={busy !== null}
              onClick={() => enter(p)}
            >
              <span className="text-xl">{busy === p.key ? "Opening…" : `Continue as ${p.label}`}</span>
              <span className="text-base font-normal text-muted">{p.detail}</span>
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="w-full" onClick={reset} disabled={busy !== null}>
        {busy === "reset" ? "Resetting…" : "Reset the demo"}
      </Button>
    </div>
  );
}
