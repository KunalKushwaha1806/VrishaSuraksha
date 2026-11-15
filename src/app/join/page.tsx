import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { JoinCircleForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Join a care circle" };

export default function JoinPage() {
  return (
    <AuthShell title="Join a care circle" subtitle="You need the circle code and a one-time invite passcode.">
      <JoinCircleForm />
    </AuthShell>
  );
}
