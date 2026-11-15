import { describe, expect, it } from "vitest";
import { harness } from "./helpers";
import { logActivity, logConsent } from "@/lib/activity";
import { C } from "@/lib/models";

describe("Activity & Consent Audit Trail", () => {
  it("records immutable activity audit entries", async () => {
    const { db, circle, elder } = await harness();

    await logActivity(circle.id, elder, "exported medical history", "circle", circle.id);

    const entries = await db.query(C.activity(circle.id));
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e) => (e as { action: string }).action === "exported medical history");
    expect(entry).toBeDefined();
    expect((entry as { actorName: string }).actorName).toBe(elder.name);
  });

  it("records consent changes for privacy compliance", async () => {
    const { db, circle, elder, family } = await harness();

    await logConsent(circle.id, family, "granted access to appointments", elder.id);

    const consentList = await db.query(C.consent(circle.id));
    expect(consentList.length).toBeGreaterThan(0);
    const consent = consentList.find((c) => (c as { change: string }).change === "granted access to appointments");
    expect(consent).toBeDefined();
    expect((consent as { memberName: string }).memberName).toBe(family.name);
  });
});
