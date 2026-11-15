"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiClientError, errorText } from "@/lib/client/api";
import { canListen, listenOnce, matchesAny } from "@/lib/client/speech";
import { useDashboard } from "@/lib/client/useDashboard";
import { t, TAKEN_PHRASES, type Dict } from "@/lib/i18n";
import type { Lang, MissedReason, ReactionKind } from "@/lib/models";
import type { Dashboard } from "@/lib/services/dashboard";
import { formatTime } from "@/lib/time";
import { Badge, Button, Card, ErrorState, LoadingState, Notice } from "../ui";
import { ExplainMedicine } from "./ExplainMedicine";

type TodayDose = Dashboard["today"][number];

const LOGGABLE_AHEAD_MS = 3 * 60 * 60 * 1000;

const REASONS: Array<{ key: MissedReason; label: (d: Dict) => string; icon: string }> = [
  { key: "forgot", label: (d) => d.reasonForgot, icon: "🤔" },
  { key: "unwell", label: (d) => d.reasonUnwell, icon: "🤒" },
  { key: "side_effect", label: (d) => d.reasonSideEffect, icon: "⚠️" },
  { key: "ran_out", label: (d) => d.reasonRanOut, icon: "📦" },
];

function reactionText(kind: ReactionKind, d: Dict): string {
  const map: Record<ReactionKind, string> = {
    heart: d.reactionHeart,
    proud: d.reactionProud,
    love: d.reactionLove,
    call_soon: d.reactionCallSoon,
    take_care: d.reactionTakeCare,
  };
  return map[kind];
}

function statusLabel(status: TodayDose["status"], d: Dict) {
  if (status === "TAKEN") return <Badge tone="ok">{d.taken}</Badge>;
  if (status === "SKIPPED") return <Badge tone="info">{d.skipped}</Badge>;
  if (status === "MISSED") return <Badge tone="warn">{d.missed}</Badge>;
  return <Badge tone="info">{d.pending}</Badge>;
}

/** The elder's screen: one question at a time, large text, Hindi or English, voice when available. */
export function ElderHome() {
  const { data, error, refresh } = useDashboard();
  const welcome = useSearchParams().get("welcome");
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return <LoadingState />;
  return <ElderScreen data={data} refresh={refresh} welcomeCode={welcome} />;
}

function ElderScreen({ data, refresh, welcomeCode }: { data: Dashboard; refresh: () => Promise<void>; welcomeCode: string | null }) {
  const lang: Lang = data.me.language;
  const d = t(lang);
  const now = Date.now();
  const firstName = data.me.name.split(" ")[0];

  const focus = useMemo(
    () => data.today.find((x) => x.status === "PENDING" && new Date(x.scheduledFor).getTime() <= now + LOGGABLE_AHEAD_MS) ?? null,
    [data.today, now],
  );
  const later = data.today.find((x) => x.status === "PENDING" && x !== focus);
  const voice = focus
    ? (data.voiceNotes.find((v) => v.medicationId === focus.medicationId) ?? data.voiceNotes.find((v) => !v.medicationId && !v.playedAt))
    : undefined;

  const [step, setStep] = useState<"ask" | "reasons" | "double">("ask");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [listening, setListening] = useState(false);

  async function log(body: { status: "TAKEN" | "MISSED"; reason?: MissedReason; confirmDouble?: boolean }) {
    if (!focus) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/doses/${encodeURIComponent(focus.id)}`, { body });
      setMessage({ tone: "ok", text: d.logged });
      setStep("ask");
      await refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details.reason === "double_dose") setStep("double");
      else setMessage({ tone: "danger", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function voiceLog() {
    setListening(true);
    setMessage({ tone: "ok", text: d.listening });
    try {
      const heard = await listenOnce(lang);
      if (matchesAny(heard, TAKEN_PHRASES)) {
        setMessage({ tone: "ok", text: d.heardTaken });
        await log({ status: "TAKEN" });
      } else {
        setMessage({ tone: "warn", text: d.heardUnknown });
      }
    } catch {
      setMessage({ tone: "warn", text: d.voiceUnsupported });
    } finally {
      setListening(false);
    }
  }

  async function toggleLanguage() {
    await api("/api/me", { method: "PATCH", body: { language: lang === "hi" ? "en" : "hi" } });
    await refresh();
  }

  return (
    <div lang={lang} className="space-y-6 text-xl">
      {welcomeCode ? (
        <Notice tone="ok" title="Your care circle is ready">
          Share the circle code <strong>{welcomeCode}</strong> with your family, then create invite passcodes from “Who can see what”.
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">
          {d.greeting}, {firstName}
        </h1>
        <Button variant="ghost" size="lg" onClick={toggleLanguage}>
          {d.language}
        </Button>
      </div>

      <Card className="border-2 border-brand">
        <p className="text-2xl font-semibold" aria-live="polite">
          <span aria-hidden="true">🔥 </span>
          {data.streak > 0 ? (
            <>
              <strong className="text-4xl">{data.streak}</strong> {d.streakDays}
            </>
          ) : (
            d.streakStart
          )}
        </p>
      </Card>

      <section aria-labelledby="next-dose">
        {focus ? (
          <Card className="space-y-5">
            <h2 id="next-dose" className="text-2xl text-muted">
              {d.nextDose}
            </h2>
            <div>
              <p className="text-4xl font-bold">{focus.medName}</p>
              <p className="mt-1 text-2xl text-muted">
                {focus.doseText} · {d.at} {formatTime(focus.scheduledFor)}
              </p>
            </div>

            {voice ? (
              <div className="rounded-2xl bg-surface-2 p-4">
                <p className="font-semibold">
                  <span aria-hidden="true">🎙️ </span>
                  {lang === "hi" ? `${voice.fromName} ${d.voiceFrom}` : `${d.voiceFrom} ${voice.fromName}`}
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a personal family voice message; no transcript exists. The sender is named above. */}
                <audio controls preload="none" className="mt-2 w-full" src={`/api/voice-notes/${encodeURIComponent(voice.id)}`}>
                  {d.play}
                </audio>
              </div>
            ) : null}

            {step === "ask" ? (
              <div className="grid gap-3">
                <Button size="xl" onClick={() => log({ status: "TAKEN" })} disabled={busy}>
                  <span aria-hidden="true">✅</span> {d.tookIt}
                </Button>
                <Button size="xl" variant="secondary" onClick={() => setStep("reasons")} disabled={busy}>
                  {d.notNow}
                </Button>
                {canListen() ? (
                  <Button size="lg" variant="ghost" onClick={voiceLog} disabled={busy || listening} aria-label={d.sayIt}>
                    <span aria-hidden="true">🎤</span> {listening ? d.listening : d.sayIt}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {step === "reasons" ? (
              <fieldset className="space-y-3">
                <legend className="mb-2 text-2xl font-semibold">{d.whyMissed}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {REASONS.map((r) => (
                    <Button key={r.key} size="xl" variant="secondary" onClick={() => log({ status: "MISSED", reason: r.key })} disabled={busy}>
                      <span aria-hidden="true">{r.icon}</span> {r.label(d)}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="lg" onClick={() => setStep("ask")}>
                  {d.cancel}
                </Button>
              </fieldset>
            ) : null}

            {step === "double" ? (
              <div className="space-y-3">
                <Notice tone="warn">{d.doubleDoseWarn}</Notice>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button size="xl" variant="secondary" onClick={() => setStep("ask")}>
                    {d.cancel}
                  </Button>
                  <Button size="lg" variant="danger" onClick={() => log({ status: "TAKEN", confirmDouble: true })} disabled={busy}>
                    {d.doubleDoseConfirm}
                  </Button>
                </div>
              </div>
            ) : null}

            <ExplainMedicine medicationId={focus.medicationId} lang={lang} d={d} serverVoice={data.features.tts} />
          </Card>
        ) : (
          <Card>
            <h2 id="next-dose" className="text-3xl font-bold">
              {data.today.length === 0 ? d.nothingToday : later ? `${d.nextDose}: ${later.medName}` : d.allDone}
            </h2>
            <p className="mt-2 text-2xl text-muted">
              {later ? `${d.at} ${formatTime(later.scheduledFor)}` : data.today.length ? d.allDoneSub : null}
            </p>
          </Card>
        )}
        {message ? (
          <div className="mt-3">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        ) : null}
      </section>

      {data.today.length ? (
        <section aria-labelledby="today">
          <h2 id="today" className="mb-3 text-2xl font-bold">
            {lang === "hi" ? "आज" : "Today"}
          </h2>
          <ul className="space-y-2">
            {data.today.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                <span>
                  <span className="font-semibold">{x.medName}</span>
                  <span className="block text-lg text-muted">{formatTime(x.scheduledFor)}</span>
                </span>
                {statusLabel(x.status, d)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.reactions.length ? (
        <section aria-labelledby="messages">
          <h2 id="messages" className="mb-3 text-2xl font-bold">
            {d.messages}
          </h2>
          <ul className="space-y-2">
            {data.reactions.slice(0, 4).map((r) => (
              <li key={r.id} className="rounded-2xl bg-surface-2 p-4">
                <span aria-hidden="true">{r.kind === "heart" ? "❤️ " : "💌 "}</span>
                <strong>{r.fromName}</strong> {reactionText(r.kind, d)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <nav aria-label={lang === "hi" ? "और" : "More"} className="grid gap-3 sm:grid-cols-2">
        {[
          { href: "/app/medicines", label: d.myMedicines, icon: "💊" },
          { href: "/app/appointments", label: d.appointments, icon: "🩺" },
          { href: "/app/members", label: d.privacy, icon: "🔒" },
          { href: "/app/emergency", label: d.emergency, icon: "🆘" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-20 items-center gap-3 rounded-3xl border-2 border-line bg-surface px-5 text-2xl font-semibold hover:border-brand">
            <span aria-hidden="true">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
