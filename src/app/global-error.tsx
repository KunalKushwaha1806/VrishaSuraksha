"use client";

/**
 * Root error boundary to catch catastrophic unhandled exceptions inside the root layout.
 * Next.js requires global-error to define its own <html> and <body> tags.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#fffaf3] px-6 py-12 text-center text-[#2a2118] dark:bg-[#161210] dark:text-[#f8f5f0]">
        <main className="max-w-md space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950/60">
            ⚠️
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="text-base text-stone-600 dark:text-stone-400">
            An unexpected error occurred. Your health records and medication schedules remain safe.
          </p>
          <div className="pt-4">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-[#2a2118] px-6 text-base font-semibold text-white shadow-sm transition hover:opacity-90 dark:bg-[#f8f5f0] dark:text-[#161210]"
            >
              Reload application
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
