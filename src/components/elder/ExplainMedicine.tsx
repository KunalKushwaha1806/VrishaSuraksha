"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { speak, stopSpeaking } from "@/lib/client/speech";
import type { Dict } from "@/lib/i18n";
import type { Lang } from "@/lib/models";
import { Button, Notice } from "../ui";

/** "What is this medicine for?" with a spoken answer (Cloud TTS, or the phone's own voice). */
export function ExplainMedicine({
  medicationId,
  lang,
  d,
  serverVoice,
}: {
  medicationId: string;
  lang: Lang;
  d: Dict;
  serverVoice: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setText(null);
    setError(null);
    return () => {
      stopSpeaking();
      audioRef.current?.pause();
    };
  }, [medicationId, lang]);

  async function readAloud(content: string) {
    setSpeaking(true);
    if (serverVoice) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medicationId, language: lang }),
        });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          await audio.play();
          return;
        }
      } catch {
        // fall through to the phone's voice
      }
    }
    speak(content, lang, () => setSpeaking(false));
  }

  function stop() {
    stopSpeaking();
    audioRef.current?.pause();
    setSpeaking(false);
  }

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ text: string }>("/api/explain", { body: { medicationId, language: lang } });
      setText(res.text);
      void readAloud(res.text);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!text ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={ask} disabled={busy}>
          <span aria-hidden="true">💬</span> {busy ? "…" : d.whatIsThis}
        </Button>
      ) : (
        <div className="rounded-2xl bg-surface-2 p-4" aria-live="polite">
          <p className="text-xl leading-relaxed" lang={lang}>
            {text}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {speaking ? (
              <Button variant="secondary" size="lg" onClick={stop}>
                <span aria-hidden="true">⏹</span> {d.stopSpeaking}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" onClick={() => readAloud(text)}>
                <span aria-hidden="true">🔊</span> {d.speak}
              </Button>
            )}
          </div>
        </div>
      )}
      {error ? <Notice tone="warn">{error}</Notice> : null}
    </div>
  );
}
