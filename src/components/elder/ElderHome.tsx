"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { api, ApiClientError, errorText } from "@/lib/client/api";
import { queueOfflineDose, setupOfflineSyncListener } from "@/lib/client/offlineQueue";
import { canListen, listenOnce, matchesAny } from "@/lib/client/speech";
import { useDashboard } from "@/lib/client/useDashboard";
import { t, TAKEN_PHRASES, type Dict } from "@/lib/i18n";
import type { Lang, MissedReason, ReactionKind } from "@/lib/models";
import type { Dashboard } from "@/lib/services/dashboard";
import { formatTime } from "@/lib/time";
import { Badge, Button, Card, ErrorState, LoadingState, Notice } from "../ui";
import { ExplainMedicine } from "./ExplainMedicine";

type TodayDose = Dashboard["today"][number];

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

function statusBadge(status: TodayDose["status"], d: Dict) {
  if (status === "TAKEN") return <Badge tone="ok">{d.taken}</Badge>;
  if (status === "SKIPPED") return <Badge tone="info">{d.skipped}</Badge>;
  if (status === "MISSED") return <Badge tone="warn">{d.missed}</Badge>;
  return <Badge tone="warn">{d.pending}</Badge>;
}

/** The elder's screen: warm, high-contrast, large text, voice-friendly. */
export function ElderHome() {
  const { data, error, refresh } = useDashboard();
  const welcome = useSearchParams().get("welcome");
  if (error && !data) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return <LoadingState label="Loading Dadaji's dashboard…" />;
  return <ElderScreen data={data} refresh={refresh} welcomeCode={welcome} />;
}

function ElderScreen({
  data,
  refresh,
  welcomeCode,
}: {
  data: Dashboard;
  refresh: () => Promise<void>;
  welcomeCode: string | null;
}) {
  const lang: Lang = data.me.language;
  const d = t(lang);
  const firstName = data.me.name.split(" ")[0];

  const [selectedDoseId, setSelectedDoseId] = useState<string | null>(null);

  // Focus on the first pending dose, or user-selected dose
  const focus = useMemo(() => {
    if (selectedDoseId) {
      const found = data.today.find((x) => x.id === selectedDoseId);
      if (found) return found;
    }
    return data.today.find((x) => x.status === "PENDING") ?? null;
  }, [data.today, selectedDoseId]);

  const voice = focus
    ? (data.voiceNotes.find((v) => v.medicationId === focus.medicationId) ??
      data.voiceNotes.find((v) => !v.medicationId && !v.playedAt))
    : undefined;

  const [step, setStep] = useState<"ask" | "reasons" | "double">("ask");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "danger"; text: string } | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    return setupOfflineSyncListener(refresh);
  }, [refresh]);

  async function log(body: { status: "TAKEN" | "MISSED"; reason?: MissedReason; confirmDouble?: boolean }) {
    if (!focus) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/api/doses/${encodeURIComponent(focus.id)}`, { body });
      setMessage({ tone: "ok", text: d.logged });
      setStep("ask");
      setSelectedDoseId(null);
      await refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.details.reason === "double_dose") {
        setStep("double");
      } else if (err instanceof ApiClientError && (err.code === "offline" || !navigator.onLine)) {
        queueOfflineDose(focus.id, `/api/doses/${encodeURIComponent(focus.id)}`, body);
        setMessage({
          tone: "ok",
          text: lang === "hi" ? "ऑफ़लाइन सहेजा गया। इंटरनेट आने पर सिंक होगा।" : "Saved offline. Will sync when back online.",
        });
        setStep("ask");
        setSelectedDoseId(null);
      } else {
        setMessage({ tone: "danger", text: errorText(err) });
      }
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

  const takenCount = data.today.filter((x) => x.status === "TAKEN").length;
  const allComplete = data.today.length > 0 && takenCount === data.today.length;

  return (
    <div lang={lang} className="space-y-6 text-xl max-w-3xl mx-auto pb-12">
      {welcomeCode ? (
        <Notice tone="ok" title="Your care circle is ready">
          Share the circle code <strong>{welcomeCode}</strong> with your family, then create invite passcodes from “Who
          can see what”.
        </Notice>
      ) : null}

      {/* Top Banner: Warm Personalized Greeting & Language Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-linear-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 p-6 border border-amber-500/20 shadow-xs">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand">
            {lang === "hi" ? "नमस्ते · आपका स्वास्थ्य साथी" : "Namaste · Daily Care Partner"}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black text-ink">
            {d.greeting}, {firstName} Ji
          </h1>
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-brand/40 bg-surface px-5 py-2.5 text-lg font-bold text-ink shadow-xs hover:border-brand hover:scale-105 transition-all cursor-pointer"
        >
          <span>🌐</span> {d.language}
        </button>
      </div>

      {/* Streak & Family Encouragement Card */}
      <Card className="border-2 border-amber-400/40 bg-linear-to-br from-amber-500/10 to-orange-500/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-3xl shadow-xs"
              aria-hidden="true"
            >
              🔥
            </span>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-ink">
                {data.streak > 0 ? (
                  <>
                    <span>{data.streak}</span> {d.streakDays}
                  </>
                ) : (
                  d.streakStart
                )}
              </p>
              <p className="text-base text-muted font-medium mt-0.5">
                {lang === "hi"
                  ? "नियमित दवाएं लेने से स्वास्थ्य बेहतर रहता है।"
                  : "Daily adherence keeps you healthy and independent."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-surface px-3 py-1.5 text-sm font-bold border border-line text-ink">
              {takenCount} / {data.today.length} {lang === "hi" ? "ली गईं" : "taken"}
            </span>
          </div>
        </div>
      </Card>

      {/* Main Focus: Active Dose / Due Dose */}
      <section aria-labelledby="active-dose">
        {focus ? (
          <Card className="space-y-6 border-2 border-brand/50 shadow-md p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
              <span className="inline-flex items-center gap-2 text-xl font-bold text-brand">
                <span>💊</span> {d.nextDose}
              </span>
              <span className="rounded-full bg-surface-2 border border-line px-4 py-1 text-base font-bold text-ink">
                ⏰ {formatTime(focus.scheduledFor)}
              </span>
            </div>

            <div>
              <h2 id="active-dose" className="text-4xl sm:text-5xl font-black tracking-tight text-ink">
                {focus.medName}
              </h2>
              <p className="mt-2 text-2xl text-muted font-medium">
                {focus.doseText || "1 dose"} · {d.at} {formatTime(focus.scheduledFor)}
              </p>
            </div>

            {/* Family Voice Note Playback if present */}
            {voice ? (
              <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/40 p-4 shadow-xs">
                <p className="font-bold text-lg text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <span>🎙️</span>
                  {lang === "hi" ? `${voice.fromName} का वॉइस संदेश` : `Voice note from ${voice.fromName}`}
                </p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  controls
                  preload="metadata"
                  className="mt-2.5 w-full"
                  src={`/api/voice-notes/${encodeURIComponent(voice.id)}`}
                >
                  {d.play}
                </audio>
              </div>
            ) : null}

            {/* Action State: Ask */}
            {step === "ask" ? (
              <div className="space-y-3 pt-2">
                <Button
                  size="xl"
                  variant="primary"
                  className="w-full min-h-18 text-2xl sm:text-3xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                  onClick={() => log({ status: "TAKEN" })}
                  disabled={busy}
                >
                  <span aria-hidden="true" className="text-3xl">
                    ✅
                  </span>{" "}
                  {d.tookIt}
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full text-lg font-bold border-2"
                    onClick={() => setStep("reasons")}
                    disabled={busy}
                  >
                    <span>🤔</span> {d.notNow}
                  </Button>

                  {canListen() ? (
                    <Button
                      size="lg"
                      variant="ghost"
                      className="w-full border-2 border-line hover:border-brand/40 text-lg font-bold"
                      onClick={voiceLog}
                      disabled={busy || listening}
                      aria-label={d.sayIt}
                    >
                      <span aria-hidden="true">🎤</span> {listening ? d.listening : d.sayIt}
                    </Button>
                  ) : (
                    <div className="flex items-center justify-center text-sm text-muted">
                      💡 {lang === "hi" ? "एक टैप से आसानी से खुराक दर्ज करें" : "Tap green button once taken"}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Action State: Missed Reason Triage */}
            {step === "reasons" ? (
              <fieldset className="space-y-4 pt-2">
                <legend className="text-2xl font-bold text-ink mb-1">{d.whyMissed}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {REASONS.map((r) => (
                    <Button
                      key={r.key}
                      size="lg"
                      variant="secondary"
                      className="justify-start px-4 text-left font-bold border-2"
                      onClick={() => log({ status: "MISSED", reason: r.key })}
                      disabled={busy}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {r.icon}
                      </span>
                      <span>{r.label(d)}</span>
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="md" onClick={() => setStep("ask")} className="mt-2">
                  ← {d.cancel}
                </Button>
              </fieldset>
            ) : null}

            {/* Action State: Double Dose Warning */}
            {step === "double" ? (
              <div className="space-y-4 pt-2">
                <Notice tone="warn">{d.doubleDoseWarn}</Notice>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button size="lg" variant="secondary" onClick={() => setStep("ask")}>
                    {d.cancel}
                  </Button>
                  <Button
                    size="lg"
                    variant="danger"
                    onClick={() => log({ status: "TAKEN", confirmDouble: true })}
                    disabled={busy}
                  >
                    {d.doubleDoseConfirm}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Simple-words AI Medicine Explainer (Spoken aloud in Hindi or English) */}
            <div className="border-t border-line pt-4">
              <ExplainMedicine medicationId={focus.medicationId} lang={lang} d={d} serverVoice={data.features.tts} />
            </div>
          </Card>
        ) : (
          <Card className="text-center py-10 bg-linear-to-b from-surface to-surface-2 border border-line">
            <span className="text-5xl" aria-hidden="true">
              {allComplete ? "🎉" : "☀️"}
            </span>
            <h2 id="active-dose" className="mt-4 text-3xl font-extrabold text-ink">
              {allComplete
                ? lang === "hi"
                  ? "शाबाश दादाजी! आज की सभी दवाएं पूरी हुईं"
                  : "Wonderful Dadaji! All medicines complete for today"
                : d.nothingToday}
            </h2>
            <p className="mt-2 text-xl text-muted font-medium max-w-md mx-auto">
              {allComplete
                ? lang === "hi"
                  ? "परिवार निश्चिंत है और आपका स्वास्थ्य सुरक्षित है।"
                  : "Your family is in the loop and your health is on track."
                : d.allDoneSub}
            </p>
          </Card>
        )}

        {message ? (
          <div className="mt-4">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        ) : null}
      </section>

      {/* Today's Schedule Overview */}
      {data.today.length ? (
        <section aria-labelledby="today-list">
          <div className="flex items-center justify-between mb-3">
            <h2 id="today-list" className="text-2xl font-bold text-ink flex items-center gap-2">
              <span>📋</span> {lang === "hi" ? "आज की सभी दवाएं" : "Today's Schedule"}
            </h2>
            <span className="text-sm font-semibold text-muted">
              {data.today.length} {lang === "hi" ? "कुल खुराकें" : "doses"}
            </span>
          </div>

          <ul className="space-y-3">
            {data.today.map((x) => {
              const isSelected = focus?.id === x.id;
              return (
                <li
                  key={x.id}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? "border-brand bg-brand-light/30 shadow-xs"
                      : "border-line bg-surface hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" aria-hidden="true">
                      {x.status === "TAKEN" ? "✅" : x.status === "MISSED" ? "⚠️" : "💊"}
                    </span>
                    <div>
                      <p className="font-extrabold text-xl text-ink leading-tight">{x.medName}</p>
                      <p className="text-base text-muted font-medium">
                        {x.doseText} · {formatTime(x.scheduledFor)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {statusBadge(x.status, d)}
                    {x.status === "PENDING" && !isSelected ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDoseId(x.id);
                          setStep("ask");
                        }}
                        className="rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-sm font-bold text-ink hover:border-brand cursor-pointer"
                      >
                        {lang === "hi" ? "खुराक चुनें" : "Select"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Love & Encouragement from Family */}
      {data.reactions.length ? (
        <section aria-labelledby="family-messages">
          <h2 id="family-messages" className="mb-3 text-2xl font-bold text-ink flex items-center gap-2">
            <span>❤️</span> {d.messages}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.reactions.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 p-4 shadow-2xs"
              >
                <span className="text-2xl" aria-hidden="true">
                  {r.kind === "heart" ? "❤️" : r.kind === "proud" ? "🌟" : "💌"}
                </span>
                <p className="mt-2 text-lg font-bold text-ink">{r.fromName}</p>
                <p className="text-base text-muted font-medium">{reactionText(r.kind, d)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Quick Navigation Footer */}
      <nav aria-label={lang === "hi" ? "और विकल्प" : "More options"} className="grid gap-3 sm:grid-cols-2 pt-4">
        <Link
          href="/app/emergency"
          className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger-bg/40 p-4 font-bold text-ink hover:bg-danger-bg/70 transition shadow-xs"
        >
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-lg font-extrabold text-danger">
              {lang === "hi" ? "इमरजेंसी मेडिकल कार्ड" : "Emergency QR Card"}
            </p>
            <p className="text-sm text-muted font-normal">
              {lang === "hi" ? "आपातकालीन संपर्क और दवाएं" : "Emergency contacts and meds"}
            </p>
          </div>
        </Link>

        <Link
          href="/app/medicines"
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 font-bold text-ink hover:border-brand transition shadow-xs"
        >
          <span className="text-2xl">💊</span>
          <div>
            <p className="text-lg font-extrabold text-ink">
              {lang === "hi" ? "दवाओं की पूरी सूची" : "All Medicines List"}
            </p>
            <p className="text-sm text-muted font-normal">
              {lang === "hi" ? "स्टॉक और समय की जानकारी" : "Stock and schedules"}
            </p>
          </div>
        </Link>
      </nav>
    </div>
  );
}
