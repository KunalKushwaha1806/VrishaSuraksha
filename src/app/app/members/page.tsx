import type { Metadata } from "next";
import { MembersManager } from "@/components/MembersManager";
import { requirePage } from "@/lib/auth/requirePage";

export const metadata: Metadata = { title: "Care circle" };

export default async function MembersPage() {
  const { member } = await requirePage("members:read");
  return <MembersManager myRole={member.role} myId={member.id} />;
}
