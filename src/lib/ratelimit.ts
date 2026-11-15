import { getDb } from "./db";
import { C } from "./models";
import { sha256 } from "./crypto";

/**
 * Two layers of brute-force protection:
 * 1. A per-instance fixed-window limiter keyed by IP (cheap, stops floods).
 * 2. A persistent lockout in Firestore keyed by circle + identity, so
 *    repeated wrong passcodes lock the account across all instances.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function hitLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: boolean; retryAfterSec: number } {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  w.count++;
  return { ok: w.count <= limit, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
}

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60_000;
export const LOCKOUT_DURATION_MS = 15 * 60_000;

interface AttemptDoc {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const docId = (key: string) => sha256(key).slice(0, 40);

export async function lockedFor(key: string, now = Date.now()): Promise<number> {
  const db = await getDb();
  const doc = await db.get<AttemptDoc>(C.loginAttempts, docId(key));
  return doc && doc.lockedUntil > now ? Math.ceil((doc.lockedUntil - now) / 1000) : 0;
}

export async function recordFailure(key: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const doc = await tx.get<AttemptDoc>(C.loginAttempts, docId(key));
    const fresh = !doc || now - doc.windowStart > LOCKOUT_WINDOW_MS;
    const failures = fresh ? 1 : doc.failures + 1;
    tx.set(C.loginAttempts, docId(key), {
      failures,
      windowStart: fresh ? now : doc.windowStart,
      lockedUntil: failures >= LOCKOUT_THRESHOLD ? now + LOCKOUT_DURATION_MS : (doc?.lockedUntil ?? 0),
    });
  });
}

export async function clearFailures(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(C.loginAttempts, docId(key));
}
