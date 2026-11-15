import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FamilyHome } from "@/components/family/FamilyHome";
import { currentAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyPage() {
  const auth = await currentAuth();
  if (!auth) redirect("/login");
  if (auth.member.role !== "FAMILY") redirect("/app");
  return <FamilyHome />;
}
