import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-lg px-5 py-10">
      <Link href="/" className="text-lg font-semibold text-brand underline-offset-4 hover:underline">
        ← VridhaSuraksha
      </Link>
      <h1 className="mt-4 text-3xl font-bold">{title}</h1>
      {subtitle ? <p className="mt-2 text-lg text-muted">{subtitle}</p> : null}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm">{children}</div>
    </main>
  );
}
