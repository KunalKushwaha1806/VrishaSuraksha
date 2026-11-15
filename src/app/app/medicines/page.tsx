import type { Metadata } from "next";
import { Suspense } from "react";
import { MedicinesManager } from "@/components/care/MedicinesManager";
import { LoadingState } from "@/components/ui";
import { requirePage } from "@/lib/auth/requirePage";
import { can } from "@/lib/domain/permissions";

export const metadata: Metadata = { title: "Medicines" };

export default async function MedicinesPage() {
  const { member } = await requirePage("meds:read");
  return (
    <Suspense fallback={<LoadingState />}>
      <MedicinesManager canEdit={can(member.role, "meds:write")} />
    </Suspense>
  );
}
