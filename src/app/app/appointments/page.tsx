import type { Metadata } from "next";
import { AppointmentsManager } from "@/components/care/AppointmentsManager";
import { EmptyState } from "@/components/ui";
import { requirePage } from "@/lib/auth/requirePage";
import { can, canSee } from "@/lib/domain/permissions";

export const metadata: Metadata = { title: "Doctor visits" };

export default async function AppointmentsPage() {
  const { member } = await requirePage("appointments:read");
  if (!canSee(member, "appointments")) {
    return (
      <EmptyState title="Doctor visits are private">The elder has chosen not to share visits with you.</EmptyState>
    );
  }
  return (
    <AppointmentsManager canEdit={can(member.role, "appointments:write")} canBrief={can(member.role, "brief:read")} />
  );
}
