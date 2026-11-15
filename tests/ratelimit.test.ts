import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import { clearFailures, hitLimit, lockedFor, recordFailure } from "@/lib/ratelimit";

describe("Rate Limiting & Account Lockout", () => {
  it("enforces sliding window request limits", () => {
    const key = `test-ip-${Date.now()}`;
    const limit = 3;
    const windowMs = 5000;
    const t0 = 100000;

    // Hits 1, 2, 3 succeed
    expect(hitLimit(key, limit, windowMs, t0).ok).toBe(true);
    expect(hitLimit(key, limit, windowMs, t0 + 100).ok).toBe(true);
    expect(hitLimit(key, limit, windowMs, t0 + 200).ok).toBe(true);

    // Hit 4 is blocked
    const blocked = hitLimit(key, limit, windowMs, t0 + 300);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    // After window expires, succeeds again
    const afterWindow = hitLimit(key, limit, windowMs, t0 + 6000);
    expect(afterWindow.ok).toBe(true);
  });

  it("locks accounts after consecutive failures across instances", async () => {
    await harness(); // Sets up in-memory DB
    const accountKey = `test-user-${Date.now()}`;
    const now = Date.now();

    // Initially not locked
    expect(await lockedFor(accountKey, now)).toBe(0);

    // 4 failures: still not locked
    for (let i = 0; i < 4; i++) {
      await recordFailure(accountKey, now + i * 100);
    }
    expect(await lockedFor(accountKey, now + 500)).toBe(0);

    // 5th failure: enters lockout
    await recordFailure(accountKey, now + 600);
    const lockTime = await lockedFor(accountKey, now + 700);
    expect(lockTime).toBeGreaterThan(0);

    // Clearing failures resets the lockout
    await clearFailures(accountKey);
    expect(await lockedFor(accountKey, now + 800)).toBe(0);
  });
});
