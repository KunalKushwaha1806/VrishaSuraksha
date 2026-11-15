import type { Metadata } from "next";
import { SettingsPanel } from "@/components/SettingsPanel";
import { requirePage } from "@/lib/auth/requirePage";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { member, circle } = await requirePage("circle:read");
  return <SettingsPanel language={member.language} isElder={member.role === "ELDER"} circleName={circle.name} />;
}
