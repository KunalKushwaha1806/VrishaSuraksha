import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ElderHome } from "@/components/elder/ElderHome";
import { LoadingState } from "@/components/ui";
import { currentAuth } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Home" };

export default async function ElderPage() {
  const auth = await currentAuth();
  if (!auth) redirect("/login");
  if (auth.member.role !== "ELDER") redirect("/app");
  return (
    <Suspense fallback={<LoadingState />}>
      <ElderHome />
    </Suspense>
  );
}
