import { Spinner } from "@/components/ui";

/**
 * Root loading boundary for Next.js App Router streaming transitions.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] w-full flex-col items-center justify-center p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <Spinner label="Loading VridhaSuraksha…" />
      <span className="sr-only">Please wait, loading page content...</span>
    </div>
  );
}
