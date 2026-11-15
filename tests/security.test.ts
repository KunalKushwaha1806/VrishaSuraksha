import { beforeEach, describe, expect, it } from "vitest";
import { consumeActionToken, signActionToken, verifyActionToken } from "@/lib/actionTokens";
import { signSession, verifySession } from "@/lib/auth/session";
import { decryptText, encryptText, safeEqual } from "@/lib/crypto";
import { redact } from "@/lib/services/brief";
import { escapeHtml } from "@/lib/services/emailTemplates";
import { createShareToken, resolveShareToken, revokeShareToken } from "@/lib/services/care";
import { createCircle, login } from "@/lib/services/circles";
import { LOCKOUT_THRESHOLD } from "@/lib/ratelimit";
import { voiceNoteSchema, logDoseSchema } from "@/lib/validation";
import { harness, type Harness } from "./helpers";

describe("field encryption (AES-256-GCM)", () => {
  it("round-trips text", () => {
    const enc = encryptText("Felt dizzy after the night tablet")!;
    expect(enc).not.toContain("dizzy");
    expect(decryptText(enc)).toBe("Felt dizzy after the night tablet");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptText("same")).not.toBe(encryptText("same"));
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptText("secret")!;
    const parts = enc.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptText(parts.join("."))).toThrow();
  });

  it("passes empty values through", () => {
    expect(encryptText("")).toBeNull();
    expect(decryptText(null)).toBeNull();
  });
});

describe("tokens", () => {
  beforeEach(async () => {
    await harness();
  });

  it("signs and verifies sessions", async () => {
    const token = await signSession({ id: "m1", circleId: "c1", role: "CARETAKER" });
    expect(await verifySession(token)).toEqual({ sub: "m1", cid: "c1", role: "CARETAKER" });
    expect(await verifySession(`${token}x`)).toBeNull();
  });

  it("refuses to use an email action link as a session, and vice versa", async () => {
    const action = await signActionToken({ kind: "dose", circleId: "c1", memberId: "m1", ref: "d1" });
    expect(await verifySession(action)).toBeNull();
    const session = await signSession({ id: "m1", circleId: "c1", role: "ELDER" });
    expect(await verifyActionToken(session)).toBeNull();
  });

  it("allows each action link to be used only once", async () => {
    const claims = await verifyActionToken(await signActionToken({ kind: "refill", circleId: "c1", memberId: "m1", ref: "med" }));
    expect(claims).not.toBeNull();
    expect(await consumeActionToken(claims!.jti)).toBe(true);
    expect(await consumeActionToken(claims!.jti)).toBe(false);
  });

  it("compares secrets in constant time and correctly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("passcode login", () => {
  it("hashes passcodes and locks out after repeated failures", async () => {
    await harness();
    const { circle, member } = await createCircle({
      circleName: "Fam",
      elderName: "Dadaji",
      email: "dadaji@test.local",
      passcode: "123456",
      language: "en",
    });
    expect(member.passcodeHash).not.toContain("123456");
    expect((await login({ circleCode: circle.code, email: "dadaji@test.local", passcode: "123456" })).id).toBe(member.id);

    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await expect(login({ circleCode: circle.code, email: "dadaji@test.local", passcode: "wrong!" })).rejects.toMatchObject({ status: 401 });
    }
    // Even the right passcode is refused while locked.
    await expect(login({ circleCode: circle.code, email: "dadaji@test.local", passcode: "123456" })).rejects.toMatchObject({ status: 429 });
  });
});

describe("emergency share links", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await harness();
  });

  it("resolves only while active", async () => {
    const { token, share } = await createShareToken(h.circle, h.elder, 24);
    expect((await resolveShareToken(token))?.circle.id).toBe("c1");
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(await resolveShareToken(tampered)).toBeNull();
    await revokeShareToken(h.circle.id, h.elder, share.id);
    expect(await resolveShareToken(token)).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const { token, share } = await createShareToken(h.circle, h.elder, 24);
    expect(share.tokenHash).not.toBe(token);
    expect(JSON.stringify(await h.db.query("circles/c1/shareTokens"))).not.toContain(token);
  });
});

describe("input validation", () => {
  it("requires a reason for a missed dose", () => {
    expect(logDoseSchema.safeParse({ status: "MISSED" }).success).toBe(false);
    expect(logDoseSchema.safeParse({ status: "MISSED", reason: "ran_out" }).success).toBe(true);
  });

  it("only accepts short audio of allowed types", () => {
    const base = { durationSec: 10, audioBase64: "AAAAAAAAAAAA", medicationId: null };
    expect(voiceNoteSchema.safeParse({ ...base, mimeType: "audio/webm;codecs=opus" }).success).toBe(true);
    expect(voiceNoteSchema.safeParse({ ...base, mimeType: "text/html" }).success).toBe(false);
    expect(voiceNoteSchema.safeParse({ ...base, mimeType: "audio/webm", durationSec: 60 }).success).toBe(false);
  });
});

describe("output safety", () => {
  it("escapes HTML in emails", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("redacts personal details before AI calls", () => {
    const out = redact("Ramesh Sharma called +91 98765 43210 and wrote to ramesh@mail.com", ["Ramesh Sharma"]);
    expect(out).toBe("[the patient] called [phone] and wrote to [email]");
  });
});
