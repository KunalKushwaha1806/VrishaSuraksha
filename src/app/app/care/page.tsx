import type { Metadata } from "next";
import { CareDashboard } from "@/components/care/CareDashboard";
import { requirePage } from "@/lib/auth/requirePage";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CarePage() {
  await requirePage("meds:write");
  return <CareDashboard />;
}
