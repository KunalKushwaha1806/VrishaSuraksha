import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM field encryption for sensitive data at rest
 * (medical notes, symptom diary, voice notes).
 * Format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.
 */
const VERSION = "v1";

function key(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, "base64");
}

export function encryptBytes(plain: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptBytes(payload: string): Buffer {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]);
}

export function encryptText(plain: string | null | undefined): string | null {
  if (!plain) return null;
  return encryptBytes(Buffer.from(plain, "utf8"));
}

export function decryptText(payload: string | null | undefined): string | null {
  if (!payload) return null;
  return decryptBytes(payload).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Cryptographically random URL-safe token (default 32 bytes). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Short random id for documents. */
export function newId(): string {
  return randomBytes(12).toString("base64url").replace(/[-_]/g, "x");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L confusion

/** Human-friendly random code, e.g. for circle codes and invite passcodes. */
export function humanCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Constant-time string comparison (avoids timing leaks on secrets). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}
