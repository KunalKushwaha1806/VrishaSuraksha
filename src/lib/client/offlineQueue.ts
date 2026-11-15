"use client";

import { api } from "./api";

export interface QueuedDoseLog {
  id: string;
  doseId: string;
  path: string;
  body: unknown;
  queuedAt: string;
}

const STORAGE_KEY = "vridha_offline_dose_queue_v1";

export function getOfflineQueue(): QueuedDoseLog[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function queueOfflineDose(doseId: string, path: string, body: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const queue = getOfflineQueue();
    // Do not queue duplicate entry for same dose
    const filtered = queue.filter((item) => item.doseId !== doseId);
    filtered.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      doseId,
      path,
      body,
      queuedAt: new Date().toISOString(),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to queue offline dose:", err);
  }
}

export async function syncOfflineQueue(onSynced?: (count: number) => void): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedDoseLog[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      await api(item.path, { method: "POST", body: item.body });
      synced++;
    } catch (err: unknown) {
      // If error is not a network error (e.g. 409 conflict already taken), discard it so queue doesn't stick
      const e = err as { code?: string; status?: number } | undefined;
      if (e?.code === "offline" || e?.status === 0) {
        remaining.push(item);
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // Ignore storage errors
  }

  if (synced > 0 && onSynced) {
    onSynced(synced);
  }
  return synced;
}

export function setupOfflineSyncListener(onSyncComplete?: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    void syncOfflineQueue().then((synced) => {
      if (synced > 0 && onSyncComplete) {
        onSyncComplete();
      }
    });
  };

  window.addEventListener("online", handleOnline);
  // Also try syncing on startup if online
  if (navigator.onLine) {
    handleOnline();
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
