import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { CreateCircleForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Start a care circle" };

export default function CreatePage() {
  return (
    <AuthShell title="Start a care circle" subtitle="The elder owns the circle and decides who can see what.">
      <CreateCircleForm />
    </AuthShell>
  );
}
