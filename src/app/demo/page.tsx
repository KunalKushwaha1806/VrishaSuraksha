import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { DemoChooser } from "@/components/DemoChooser";
import { features } from "@/lib/env";
import { DEMO_CODE, DEMO_PASSCODE } from "@/lib/services/seed";

export const metadata: Metadata = { title: "Live demo" };

export default function DemoPage() {
  if (!features.demo()) notFound();
  return (
    <AuthShell title="Live demo" subtitle="Meet the Sharma family. Everything here is fictional. Pick who you want to be.">
      <DemoChooser />
      <p className="mt-6 text-sm text-muted">
        Prefer to sign in by hand? Circle code <strong>{DEMO_CODE}</strong>, passcode <strong>{DEMO_PASSCODE}</strong>.
      </p>
    </AuthShell>
  );
}
