import { jwtVerify, SignJWT } from "jose";
import { randomToken } from "./crypto";
import { getDb } from "./db";
import { env } from "./env";
import { C } from "./models";

/**
 * Signed, single-use, short-lived links placed in emails. Each token
 * authorises exactly one kind of action on exactly one record for one
 * member; it cannot be used as a session.
 */
export type ActionKind = "dose" | "refill";

export interface ActionClaims {
  kind: ActionKind;
  circleId: string;
  memberId: string;
  ref: string;
  jti: string;
}

const TTL_SEC = 24 * 60 * 60;
const AUDIENCE = "email-action";

const secret = () => new TextEncoder().encode(env().JWT_SECRET);

export async function signActionToken(claims: Omit<ActionClaims, "jti">): Promise<string> {
  return new SignJWT({ kind: claims.kind, cid: claims.circleId, ref: claims.ref })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.memberId)
    .setAudience(AUDIENCE)
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secret());
}

export async function verifyActionToken(token: string): Promise<ActionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE, algorithms: ["HS256"] });
    const { kind, cid, ref, sub, jti } = payload as Record<string, unknown>;
    if ((kind !== "dose" && kind !== "refill") || typeof cid !== "string" || typeof ref !== "string") return null;
    if (typeof sub !== "string" || typeof jti !== "string") return null;
    return { kind, circleId: cid, memberId: sub, ref, jti };
  } catch {
    return null;
  }
}

export async function isActionTokenUsed(jti: string): Promise<boolean> {
  const db = await getDb();
  return (await db.get(C.usedActionTokens, jti)) !== null;
}

/** Atomically marks a token as used. Returns false if it was already used. */
export async function consumeActionToken(jti: string): Promise<boolean> {
  const db = await getDb();
  const now = new Date();
  return db.create(C.usedActionTokens, jti, {
    usedAt: now.toISOString(),
    // Firestore TTL policy on this field cleans up old rows.
    expiresAt: new Date(now.getTime() + TTL_SEC * 1000).toISOString(),
  });
}

export async function actionUrl(claims: Omit<ActionClaims, "jti">): Promise<string> {
  return `${env().APP_URL}/a/${await signActionToken(claims)}`;
}
