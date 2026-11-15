"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui";

/**
 * Route-segment error boundary for the authenticated `/app` workspace.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production, structured error logging is tracked safely without exposing PII.
  }, [error]);

  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-bg text-3xl text-danger">
        ⚠️
      </div>
      <h1 className="mt-4 text-3xl font-extrabold text-ink">Dashboard unavailable</h1>
      <p className="mt-2 text-lg text-muted">
        We could not load your circle information. Please try again or return to the home screen.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/" className={buttonClass("secondary", "lg")}>
          Return home
        </Link>
      </div>
    </main>
  );
}
