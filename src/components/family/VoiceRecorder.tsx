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
    <div className="space-y-3">
      <SelectField id="voice-med" label="Play it for" value={medicationId} onChange={(e) => setMedicationId(e.target.value)}>
        <option value="">Any medicine</option>
        {medications.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <Button variant="danger" size="lg" onClick={stop}>
            <span aria-hidden="true">⏹</span> Stop ({MAX_SECONDS - seconds}s left)
          </Button>
        ) : (
          <Button size="lg" variant={state === "ready" ? "secondary" : "primary"} onClick={start} disabled={state === "saving"}>
            <span aria-hidden="true">🎙️</span> {state === "ready" ? "Record again" : "Record (15 seconds max)"}
          </Button>
        )}
        {state === "ready" || state === "saving" ? (
          <Button size="lg" onClick={save} disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : "Save message"}
          </Button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {state === "recording" ? `Recording, ${seconds} seconds` : ""}
      </p>
      {previewUrl && state !== "recording" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- preview of the user's own just-recorded message
        <audio controls src={previewUrl} className="w-full">
          Preview
        </audio>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
