/**
 * Tiny per-instance memo cache. Dashboards poll every 30 seconds, so several
 * family members watching the same circle share one computation instead of
 * each re-reading a month of dose history. Writes invalidate the circle.
 */
const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function memo<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCircle(circleId: string): void {
  for (const key of store.keys()) if (key.startsWith(`${circleId}:`)) store.delete(key);
}
