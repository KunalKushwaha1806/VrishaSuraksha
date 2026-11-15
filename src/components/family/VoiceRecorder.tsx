"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from "@/lib/limits";
import { Button, Notice, SelectField } from "../ui";

const MAX_SECONDS = MAX_VOICE_SECONDS;
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Records a short message in the browser that plays on the elder's screen at dose time. */
export function VoiceRecorder({ medications, onSaved }: { medications: Array<{ id: string; name: string }>; onSaved: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "ready" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [medicationId, setMedicationId] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices);

  async function start() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setBlob(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        setState("ready");
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setState("recording");
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setMessage({ tone: "danger", text: "Microphone permission was not given." });
    }
  }

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function save() {
    if (!blob) return;
    if (blob.size > MAX_VOICE_BYTES) {
      setMessage({ tone: "danger", text: "That recording is too large. Please keep it under 15 seconds." });
      return;
    }
    setState("saving");
    try {
      await api("/api/voice-notes", {
        body: {
          mimeType: blob.type,
          durationSec: Math.max(1, Math.min(MAX_SECONDS, seconds)),
          audioBase64: await toBase64(blob),
          medicationId: medicationId || null,
        },
      });
      setBlob(null);
      setState("idle");
      setMessage({ tone: "ok", text: "Saved. It will play at dose time." });
      onSaved();
    } catch (err) {
      setState("ready");
      setMessage({ tone: "danger", text: errorText(err) });
    }
  }

  if (!supported) return <Notice tone="info">Voice recording is not supported in this browser.</Notice>;

  return (
    <div className="space-y-4 rounded-2xl bg-surface-2/60 p-5 border border-line/60">
      <SelectField id="voice-med" label="Play it for" value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
        <option value="">Any medicine (general reminder)</option>
        {medications.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>

      {state === "recording" ? (
        <div className="flex flex-col items-center justify-center p-6 bg-danger-bg/40 border border-danger/30 rounded-2xl text-center space-y-3 animate-pulse">
          <div className="flex items-center gap-2 text-danger font-bold text-lg">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-danger"></span>
            </span>
            Recording... ({MAX_SECONDS - seconds}s remaining)
          </div>
          <div className="w-full max-w-xs bg-line rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-danger h-2.5 rounded-full transition-all duration-1000"
              style={{ width: `${(seconds / MAX_SECONDS) * 100}%` }}
            />
          </div>
          <Button variant="danger" size="lg" onClick={stop} className="mt-2 shadow-md">
            <span aria-hidden="true">⏹</span> Stop Recording
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            variant={state === "ready" ? "secondary" : "primary"}
            onClick={start}
            disabled={state === "saving"}
            className="shadow-sm"
          >
            <span aria-hidden="true" className="text-xl">🎙️</span> {state === "ready" ? "Record again" : "Start recording (15s max)"}
          </Button>
          {(state === "ready" || state === "saving") && (
            <Button size="lg" onClick={save} disabled={state === "saving"} className="bg-ok hover:bg-ok/90 text-white shadow-sm">
              {state === "saving" ? "Saving audio…" : "✓ Save & Send to Dadaji"}
            </Button>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {state === "recording" ? `Recording, ${seconds} seconds` : ""}
      </p>

      {previewUrl && state !== "recording" ? (
        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <p className="text-sm font-semibold text-muted mb-2">Listen to your message:</p>
          <audio controls src={previewUrl} className="w-full h-11 rounded-lg">
            <track kind="captions" />
            Preview
          </audio>
        </div>
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
