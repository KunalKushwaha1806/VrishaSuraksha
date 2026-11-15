import type { Metadata } from "next";
import { PrescriptionScanner } from "@/components/care/PrescriptionScanner";
import { requirePage } from "@/lib/auth/requirePage";

export const metadata: Metadata = { title: "Scan prescription" };

export default async function ScanPage() {
  await requirePage("prescription:scan");
  return <PrescriptionScanner />;
}
