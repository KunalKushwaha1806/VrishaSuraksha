import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { getDb } from "../db";
import { env } from "../env";
import { C, type Circle, type Member, type Role } from "../models";

export const SESSION_COOKIE = "vs_session";
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const ISSUER = "vridhasuraksha";

interface SessionClaims {
  sub: string;
  cid: string;
  role: Role;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function signSession(member: Pick<Member, "id" | "circleId" | "role">): Promise<string> {
  return new SignJWT({ cid: member.circleId, role: member.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(member.id)
    .setIssuer(ISSUER)
    .setAudience("session")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: "session",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || typeof payload.cid !== "string") return null;
    return { sub: payload.sub, cid: payload.cid, role: payload.role as Role };
  } catch {
    return null;
  }
}

export async function startSession(member: Pick<Member, "id" | "circleId" | "role">): Promise<void> {
  const jar = await cookies();
  const currentEnv = env();
  const isSecure = currentEnv.NODE_ENV === "production" && !currentEnv.APP_URL.startsWith("http://localhost");
  jar.set(SESSION_COOKIE, await signSession(member), {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export interface AuthContext {
  member: Member;
  circle: Circle;
}

/**
 * Resolves the signed-in member from the session cookie. The member record is
 * re-read on every request, so a revoked member loses access immediately even
 * though their cookie has not expired.
 */
export async function currentAuth(): Promise<AuthContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  const db = await getDb();
  const [member, circle] = await Promise.all([
    db.get<Member>(C.members(claims.cid), claims.sub),
    db.get<Circle>(C.circles, claims.cid),
  ]);
  if (!member || !circle || !member.active) return null;
  return { member, circle };
}
