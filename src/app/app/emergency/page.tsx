import type { Metadata } from "next";
import { EmergencyManager } from "@/components/EmergencyManager";
import { requirePage } from "@/lib/auth/requirePage";

export const metadata: Metadata = { title: "Emergency card" };

export default async function EmergencyPage() {
  const { circle } = await requirePage("share:manage");
  return <EmergencyManager initialContacts={circle.emergencyContacts} />;
}
