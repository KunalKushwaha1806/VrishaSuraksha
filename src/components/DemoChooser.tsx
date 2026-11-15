"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { Notice } from "./ui";

const PEOPLE = [
  {
    key: "elder",
    role: "ELDER",
    label: "Ramesh Sharma (Dadaji)",
    title: "Elder & Circle Owner",
    avatar: "👴",
    badge: "Voice-First · Hindi / English",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200",
    detail:
      "High-contrast, large-button interface. Speaks with Gemini for medicine explanations, logs by voice, and controls privacy.",
    target: "/app/elder",
  },
  {
    key: "caretaker",
    role: "CARETAKER",
    label: "Sunita",
    title: "Dedicated Caretaker",
    avatar: "👩‍⚕️",
    badge: "Clinical Control · AI Scanner",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200",
    detail:
      "Manages dose schedules, scans paper prescriptions with Gemini Vision, logs doses on behalf with audit notes, and tracks doctor visits.",
    target: "/app/care",
  },
  {
    key: "arjun",
    role: "FAMILY",
    member: "arjun",
    label: "Arjun",
    title: "Son (Family Care)",
    avatar: "👦",
    badge: "Refill Champion · Streak",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200",
    detail:
      "Monitors Dadaji's daily adherence streaks without guilt feeds. Receives low-stock forecasts and claims refills with one tap.",
    target: "/app/family",
  },
  {
    key: "riya",
    role: "FAMILY",
    member: "riya",
    label: "Riya",
    title: "Granddaughter",
    avatar: "👧",
    badge: "Family Voice · Hearts",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200",
    detail:
      "Records short 15-second voice notes that play on Dadaji's phone when a dose is due, and sends love reactions.",
    target: "/app/family",
  },
] as const;

export function DemoChooser() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  async function enter(person: (typeof PEOPLE)[number]) {
    setBusy(person.key);
    setError(null);
    try {
      await api("/api/demo", {
        body: { role: person.role, member: "member" in person ? person.member : undefined },
      });
      window.location.assign(person.target);
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
    <div className="space-y-6">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {resetDone ? <Notice tone="ok">The demo circle has been reset to its starting state.</Notice> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PEOPLE.map((p) => {
          const isSelected = busy === p.key;
          return (
            <button
              key={p.key}
              type="button"
              disabled={busy !== null}
              onClick={() => enter(p)}
              className="flex flex-col justify-between text-left p-5 rounded-3xl border border-line bg-surface hover:border-brand/60 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer group disabled:opacity-60"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-3xl shadow-xs group-hover:scale-110 transition-transform">
                      {p.avatar}
                    </span>
                    <div>
                      <h3 className="text-xl font-extrabold text-ink group-hover:text-brand transition-colors">
                        {p.label}
                      </h3>
                      <p className="text-sm font-semibold text-muted">{p.title}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${p.badgeColor}`}
                  >
                    {p.badge}
                  </span>
                </div>

                <p className="mt-3 text-sm text-muted leading-relaxed">{p.detail}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-line/60 flex items-center justify-between text-sm font-bold text-brand">
                <span>{isSelected ? "Opening persona…" : `Enter as ${p.label.split(" ")[0]}`}</span>
                <span className="text-lg group-hover:translate-x-1 transition-transform">
                  {isSelected ? "⏳" : "→"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted">
          💡 Fictional demo data with simulated dose history, missed triage, low stock, and 2 doctor appointments.
        </p>

        <button
          type="button"
          onClick={reset}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-muted hover:text-ink hover:border-brand/40 transition shrink-0 cursor-pointer"
        >
          <span>🔄</span> {busy === "reset" ? "Resetting…" : "Reset demo circle"}
        </button>
      </div>
    </div>
  );
}
