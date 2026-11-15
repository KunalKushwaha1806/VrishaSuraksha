import { describe, expect, it } from "vitest";
import { t, TAKEN_PHRASES } from "@/lib/i18n";

describe("i18n Localization", () => {
  it("provides complete Hindi and English dictionaries with matching keys", () => {
    const en = t("en");
    const hi = t("hi");

    expect(en.tookIt).toBe("I took it");
    expect(hi.tookIt).toBe("मैंने ले ली");

    expect(en.greeting).toBe("Namaste");
    expect(hi.greeting).toBe("नमस्ते");

    // All English keys exist in Hindi dictionary
    for (const key of Object.keys(en)) {
      expect(hi[key as keyof typeof hi]).toBeDefined();
    }
  });

  it("includes common Hindi and English voice recognition trigger phrases", () => {
    expect(TAKEN_PHRASES).toContain("took");
    expect(TAKEN_PHRASES).toContain("taken");
    expect(TAKEN_PHRASES).toContain("le li");
    expect(TAKEN_PHRASES).toContain("ले ली");
    expect(TAKEN_PHRASES).toContain("खा ली");
  });
});
