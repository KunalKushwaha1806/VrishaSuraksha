"use client";

import { Button } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-lg text-muted">Your information is safe. Please try again.</p>
      <Button size="lg" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
