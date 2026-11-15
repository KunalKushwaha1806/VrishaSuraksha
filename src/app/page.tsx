import { features } from "@/lib/env";
import { Card, Disclaimer, LinkButton } from "@/components/ui";

const HIGHLIGHTS = [
  {
    title: "The elder stays in charge",
    body: "A large-text, Hindi or English, voice-friendly screen. The elder decides exactly what each family member can see, and can revoke anyone instantly.",
  },
  {
    title: "Reminders that escalate gently",
    body: "Email nudges at dose time, then the caretaker, then family, paced by how critical each medicine is. Logging the dose stops the chain.",
  },
  {
    title: "Missed doses get the right help",
    body: "Forgot, felt unwell, side effect or ran out: each answer routes to the right person, from a refill alert to a note for the next doctor visit.",
  },
  {
    title: "Family voices at dose time",
    body: "A grandchild records a 15-second message that plays when it is time for the medicine.",
  },
  {
    title: "Prescription change detector",
    body: "Photograph a new prescription. Gemini reads it, and the app shows what was added, changed or stopped. Nothing changes until a person confirms.",
  },
  {
    title: "Streaks, not guilt",
    body: "Positive progress for the elder, hearts from the family, refill forecasts with “I'll handle it”, and a printable doctor visit brief.",
  },
];

export default function Home() {
  const demo = features.demo();
  return (
    <main id="main" className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10">
        <p className="text-lg font-semibold text-brand">VridhaSuraksha · वृद्धसुरक्षा</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">
          Dadaji stays in charge.
          <br />
          The family stays in the loop.
        </h1>
        <p className="mt-4 max-w-2xl text-xl text-muted">
          A shared, passcode-protected care circle for medicines, doctor visits and daily routines, built around the elder,
          not around the app.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {demo ? (
            <LinkButton href="/demo" size="lg">
              Try the live demo
            </LinkButton>
          ) : null}
          <LinkButton href="/create" size="lg" variant={demo ? "secondary" : "primary"}>
            Start a care circle
          </LinkButton>
          <LinkButton href="/join" size="lg" variant="secondary">
            Join with an invite
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="ghost">
            Sign in
          </LinkButton>
        </div>
      </header>

      <section aria-labelledby="highlights" className="mb-10">
        <h2 id="highlights" className="sr-only">
          What it does
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title}>
              <Card className="h-full">
                <h3 className="text-xl font-bold">{h.title}</h3>
                <p className="mt-2 text-muted">{h.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-line pt-6">
        <Disclaimer />
        <p className="mt-2 text-sm text-muted">Built with Google Cloud Run, Firestore, Gemini, Cloud Text-to-Speech and Cloud Scheduler.</p>
      </footer>
    </main>
  );
}
