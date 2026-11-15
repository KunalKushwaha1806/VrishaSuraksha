import { describe, expect, it } from "vitest";
import { invalidateCircle, memo } from "@/lib/cache";

describe("In-Memory Memo Cache", () => {
  it("caches computed values and serves from cache until TTL expires", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { val: "expensive-result", count: callCount };
    };

    const key = `test-key-${Date.now()}`;
    const res1 = await memo(key, 5000, fetcher);
    expect(res1.count).toBe(1);

    const res2 = await memo(key, 5000, fetcher);
    expect(res2.count).toBe(1); // Cached, didn't run fetcher again
    expect(callCount).toBe(1);
  });

  it("invalidates all keys associated with a circle on mutation", async () => {
    let count = 0;
    const circleId = `c-cache-${Date.now()}`;
    const key = `${circleId}:dashboard`;

    await memo(key, 10000, async () => ++count);
    expect(count).toBe(1);

    // Invalidate
    invalidateCircle(circleId);

    // Next call runs fresh
    await memo(key, 10000, async () => ++count);
    expect(count).toBe(2);
  });
});
