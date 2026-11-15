import { redirect } from "next/navigation";
import { currentAuth } from "@/lib/auth/session";

const HOME = { ELDER: "/app/elder", CARETAKER: "/app/care", FAMILY: "/app/family" } as const;

export default async function AppIndex({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const auth = await currentAuth();
  if (!auth) redirect("/login");
  const { welcome } = await searchParams;
  redirect(welcome ? `${HOME[auth.member.role]}?welcome=${encodeURIComponent(welcome)}` : HOME[auth.member.role]);
}
