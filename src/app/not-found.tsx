import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16 text-center">
      <h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-lg text-muted">It may have moved, or you may not have access to it.</p>
      <LinkButton href="/" size="lg" className="mt-6">
        Go to the start
      </LinkButton>
    </main>
  );
}
