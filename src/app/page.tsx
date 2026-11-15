import { features } from "@/lib/env";
import { Card, Disclaimer, LinkButton } from "@/components/ui";

const HIGHLIGHTS = [
  {
    icon: "👴",
    title: "Dadaji Stays in Charge",
    body: "Voice-first, large-text screen with Hindi and English support. Dadaji controls his own profile, decides who can see what, and can revoke sharing anytime.",
  },
  {
    icon: "🪜",
    title: "Criticality Escalation Ladder",
    body: "Reminders escalate gently: Elder nudge at T+0, re-nudge at T+15, caretaker alert at T+30, family alert at T+60. High-criticality medicines move faster; low criticality skips family.",
  },
  {
    icon: "🧩",
    title: "Missed-Dose Smart Triage",
    body: "When a dose is missed, Dadaji taps a reason: Ran out alerts family to refill; side effect flags the next doctor brief; felt unwell immediately notifies the caretaker.",
  },
  {
    icon: "🎙️",
    title: "Family Voice Reminders",
    body: "A grandchild records a 15-second voice note directly in the browser. It plays on Dadaji's phone when his medicine is due, with playback links included in emails.",
  },
  {
    icon: "📷",
    title: "Prescription Change Detector",
    body: "Photograph a new prescription. Gemini Vision extracts medicines, and code computes schedule diffs (Added, Changed, Stopped) for human review before applying.",
  },
  {
    icon: "🔥",
    title: "Streaks, Not Guilt",
    body: "Real adherence streaks computed directly from dose logs (no artificial counter). Family sends hearts and preset love notes, with 5-day predictive refill forecasts.",
  },
];

export default function Home() {
  const demo = features.demo();

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      {/* Hero Header */}
      <header className="mb-14 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800/60 px-4 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200 mb-4 shadow-2xs">
          <span>🏆</span> PromptWars x Catalyst Hackathon · Google for Developers
        </div>

        <h1 className="text-4xl sm:text-6xl font-black leading-[1.15] tracking-tight text-ink">
          Dadaji stays in charge.
          <br />
          <span className="text-brand">The family stays in the loop.</span>
        </h1>

        <p className="mt-5 text-lg sm:text-xl text-muted leading-relaxed max-w-2xl mx-auto">
          A shared, passcode-protected healthcare ecosystem where an elder, caretakers, and family manage
          medication schedules, monitor adherence, track doctor appointments, and receive proactive reminders.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          {demo ? (
            <LinkButton href="/demo" size="lg" className="px-8 shadow-sm text-lg">
              🚀 Explore Live Demo
            </LinkButton>
          ) : null}
          <LinkButton href="/create" size="lg" variant={demo ? "secondary" : "primary"} className="px-6 text-lg">
            Start Care Circle
          </LinkButton>
          <LinkButton href="/join" size="lg" variant="secondary" className="px-6 text-lg">
            Join with Invite
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="ghost" className="px-5 text-lg">
            Sign In
          </LinkButton>
        </div>
      </header>

      {/* Feature Highlights Grid */}
      <section aria-labelledby="highlights" className="mb-14">
        <h2 id="highlights" className="text-2xl sm:text-3xl font-black text-ink text-center mb-8">
          Beyond a Basic Medication Reminder
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title}>
              <Card className="h-full flex flex-col justify-between p-6 hover:border-brand/40 hover:shadow-md transition-all">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl shadow-2xs mb-4">
                    {h.icon}
                  </div>
                  <h3 className="text-xl font-bold text-ink">{h.title}</h3>
                  <p className="mt-2 text-base text-muted leading-relaxed">{h.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust & Medical Disclaimer Footer */}
      <footer className="border-t border-line/80 pt-8 space-y-4">
        <Disclaimer />
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <p>© 2026 VridhaSuraksha · Built with Next.js 15, PostgreSQL & Prisma, Google Gemini 2.5, and Resend.</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" className="hover:underline">Documentation</a>
            <span>·</span>
            <a href="/app/emergency" className="hover:underline">Emergency Card Demo</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
