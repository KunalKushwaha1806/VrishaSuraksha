import { Spinner } from "@/components/ui";

/**
 * Route-segment loading skeleton for the authenticated `/app` dashboard.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8" role="status" aria-live="polite">
      {/* Header skeleton */}
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-48 rounded-xl bg-surface-2" />
        <div className="h-4 w-72 rounded-lg bg-surface-2" />
      </div>

      {/* Main card skeleton */}
      <div className="animate-pulse rounded-3xl border border-line bg-surface p-6 space-y-4">
        <div className="h-6 w-36 rounded-lg bg-surface-2" />
        <div className="h-20 w-full rounded-2xl bg-surface-2" />
        <div className="flex gap-3 pt-2">
          <div className="h-12 w-32 rounded-xl bg-surface-2" />
          <div className="h-12 w-32 rounded-xl bg-surface-2" />
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <Spinner label="Loading care circle…" />
      </div>
    </div>
  );
}
