import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoChooser } from "@/components/DemoChooser";
import { features } from "@/lib/env";
import { DEMO_CODE, DEMO_PASSCODE } from "@/lib/services/seed";

export const metadata: Metadata = {
  title: "Live Interactive Demo · VridhaSuraksha",
  description: "Experience VridhaSuraksha from the perspective of an Elder, Caretaker, or Family member.",
};

export default function DemoPage() {
  if (!features.demo()) notFound();

  return (
    <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">
          ← Back to Overview
        </Link>
      </div>

      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 mb-3">
          <span>✨</span> Interactive Hackathon Sandbox
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
          Choose a Persona to Experience VridhaSuraksha
        </h1>
        <p className="mt-2 text-base sm:text-lg text-muted max-w-2xl">
          Meet the <strong>Sharma Care Circle</strong>. Everything is simulated with real data: medication schedules,
          adherence streaks, missed-dose escalation, and doctor visits. Select any role below to step in immediately.
        </p>
      </header>

      <div className="rounded-3xl border border-line/80 bg-surface/80 p-6 sm:p-8 shadow-sm">
        <DemoChooser />
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-surface-2/60 p-4 text-center text-xs text-muted">
        Prefer manual sign-in? Use Circle Code <strong className="text-ink font-mono px-1">{DEMO_CODE}</strong> and
        Passcode <strong className="text-ink font-mono px-1">{DEMO_PASSCODE}</strong> on the{" "}
        <Link href="/login" className="text-brand font-bold underline">
          Login Screen
        </Link>
        .
      </div>
    </main>
  );
}
