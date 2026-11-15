"use client";

import type { Lang } from "../models";

/**
 * Browser speech helpers. Everything degrades gracefully: if the phone has no
 * speech support the UI simply shows buttons.
 */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechLang = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

export function canListen(): boolean {
  return recognitionCtor() !== null;
}

/** Listens once and resolves with every alternative transcript, lower-cased. */
export function listenOnce(lang: Lang, timeoutMs = 8000): Promise<string[]> {
  const Ctor = recognitionCtor();
  if (!Ctor) return Promise.reject(new Error("unsupported"));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = speechLang(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    let settled = false;
    const finish = (fn: () => void) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        fn();
      }
    };
    const timer = window.setTimeout(() => {
      rec.abort();
      finish(() => resolve([]));
    }, timeoutMs);
    rec.onresult = (e) => {
      const alternatives = Array.from(e.results[0] ?? []).map((a) => a.transcript.toLowerCase().trim());
      finish(() => resolve(alternatives));
    };
    rec.onerror = (e) => finish(() => reject(new Error(e.error)));
    rec.onend = () => finish(() => resolve([]));
    rec.start();
  });
}

export function matchesAny(heard: string[], phrases: string[]): boolean {
  return heard.some((h) => phrases.some((p) => h.includes(p.toLowerCase())));
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang: Lang, onEnd?: () => void): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLang(lang);
  u.rate = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === "hi" ? "hi" : "en-in"));
  if (voice) u.voice = voice;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
