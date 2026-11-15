import { notFound, redirect } from "next/navigation";
import { currentAuth, type AuthContext } from "./session";
import { can, type Permission } from "../domain/permissions";

/** Server-side page guard: the same permission model as the API. */
export async function requirePage(permission: Permission): Promise<AuthContext> {
  const auth = await currentAuth();
  if (!auth) redirect("/login");
  if (!can(auth.member.role, permission)) notFound();
  return auth;
}
