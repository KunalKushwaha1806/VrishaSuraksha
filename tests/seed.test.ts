import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import { DEMO_CIRCLE_ID, ensureDemo, resetDemo, seedDemo } from "@/lib/services/seed";

describe("Demo Seeding Service", () => {
  it("seeds the full demo circle with members, medications, and doses", async () => {
    await harness(); // Sets up in-memory DB
    const now = new Date("2026-11-15T09:00:00.000Z");

    const circle = await seedDemo(now);
    expect(circle.id).toBe(DEMO_CIRCLE_ID);
    expect(circle.isDemo).toBe(true);

    // Calling ensureDemo returns the existing circle without duplicate seeding
    const ensured = await ensureDemo();
    expect(ensured.id).toBe(DEMO_CIRCLE_ID);

    // Calling resetDemo cleanly reseeds the circle
    const reset = await resetDemo();
    expect(reset.id).toBe(DEMO_CIRCLE_ID);
  });
});
