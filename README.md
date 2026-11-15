# VridhaSuraksha

**An elder-care and medication platform built around the elder.** The elder, their caretakers and their family share one care circle: they join with a circle code and a one-time invite passcode, then sign in with their own passcode. The app keeps the medicine schedule, records every dose, and sends email when a dose is missed or an appointment is coming up. It escalates calmly, so the elder is reminded first and family are only told if it matters.

> Built for PromptWars x Catalyst: *Elderly Care & Medication Management Platform*.

**Live demo:** `https://<your-app-url>/demo`. Pick any role; the demo circle is reset on request.

---

## What it does

| Problem-statement requirement | How VridhaSuraksha answers it |
|---|---|
| Shared access for elder, caretakers and family | A **care circle** with a 6-character circle code; each member signs in with circle code, email and their own passcode. Roles: Elder, Caretaker, Family. Invites are single-use; the elder can revoke anyone, and revocation takes effect on the very next request. |
| Manage medication schedules | Medicines with times, weekdays, dose units, stock and priority. Indian prescription notation (`1-0-1`, `BD`, `TDS`) is understood. **Scan a prescription** with Gemini, review a diff against current medicines, then apply. |
| Track adherence | A dose record for every scheduled dose: taken, late, missed or skipped. Adherence % per medicine, a 7-day summary and a streak the elder can see. |
| Doctor appointments | Appointments with reminders the day before and two hours before, plus a **doctor brief**: adherence, missed-dose reasons, symptoms and side effects in one page. Gemini writes an optional plain-language summary. |
| Proactive email reminders | A Cloud Scheduler tick every minute drives an **escalation ladder** (below). Reminders for upcoming doses, missed doses, refills and appointments. Emails carry signed single-use buttons (“I took it”), so the elder needs no login. |

### Beyond a reminder app

- **Elder-first screen.** Large type, one big “I took it” button per dose, Hindi or English, read-aloud through Google Cloud Text-to-Speech, and a voice “I took it” option.
- **Escalation by priority.** For a high-priority medicine: elder at 0 min, again at 10, caretaker at 20, family at 40, marked missed at 60. Normal and low priorities wait longer, and low priority never wakes the family.
- **Missed-dose triage.** When a dose is missed the elder taps *why*: forgot, felt unwell, side effect, or ran out. “Ran out” sets stock to zero and sends an urgent refill email; “side effect” goes into the doctor brief.
- **Double-dose guard.** Logging the same medicine again too soon is refused with a clear warning. If the elder confirms, the caretaker is told.
- **Refill forecast.** Days of stock left are calculated from the schedule. An alert goes out 5 days ahead, and one family member can claim “I'll handle it” so nobody buys twice.
- **Family voice notes** for the elder, and a simple reaction from the elder back to the family.
- **Privacy per family member.** The elder chooses which family members see missed-dose reasons, symptoms, appointments or stock.
- **Emergency card.** A shareable link with medicines, allergies and emergency contacts for a paramedic. Every view of it is logged for the circle.
- **Explain my medicine** in simple Hindi or English (Gemini), always with a medical disclaimer.
- **Data export** of the whole circle as JSON.

## Google services used

| Service | Use |
|---|---|
| **Cloud Run** | Hosts the Next.js app (standalone build, non-root container). Vercel and Render are also supported. |
| **Firestore** | All data. Transactions guarantee a reminder is sent exactly once. |
| **Gemini API** (`gemini-3-flash-preview`) | Prescription scanning, medicine explanations, doctor-brief summary. Output is JSON validated with Zod. |
| **Cloud Text-to-Speech** | Hindi and English read-aloud for the elder. The browser's voice is the fallback. |
| **Cloud Scheduler** | Calls the reminder engine every minute. |
| **Secret Manager** | JWT, encryption, cron, Gemini and SMTP secrets. |
| **Gmail SMTP** | Sends the reminder and alert emails. |

## Architecture

```
Browser (elder / caretaker / family)
   │  httpOnly session cookie, CSP nonce, same-origin checks
   ▼
Cloud Run ── Next.js 15 App Router
   ├─ src/app/api/*          route() wrapper: auth → RBAC → Zod → rate limit
   ├─ src/lib/domain/*       pure rules: schedule, escalation, adherence, refill, double dose
   ├─ src/lib/services/*     doses, medications, care, dashboard, reminder engine
   ├─ src/lib/ai/*           Gemini + Text-to-Speech, with redaction and fallbacks
   └─ src/lib/db/*           Db interface → Firestore (prod) | in-memory (dev, tests)
   ▲
Cloud Scheduler ── POST /api/cron/tick (Bearer CRON_SECRET)
                     ├─ create doses for the next 48 h
                     └─ claim due jobs in a transaction → send email → record recipients
```

Every time is stored in UTC and shown in India Standard Time.

## Security

| Threat | Mitigation |
|---|---|
| Passcode guessing | bcrypt (cost 12), per-IP rate limit, and a persistent lockout after 5 failures in 15 minutes. Unknown circles cost the same time as wrong passcodes. |
| Session theft | httpOnly, Secure, SameSite=Lax JWT cookie; the member is re-checked on every request, so revoking access is immediate. |
| CSRF | Every mutating API call must carry a matching `Origin`. |
| XSS | Per-request CSP nonce with `strict-dynamic`; no `dangerouslySetInnerHTML`; email HTML is escaped. |
| Forwarded reminder emails | Action links are signed, expire in 24 hours, work once, and opening a link changes nothing until the button is pressed. |
| Health data at rest | Notes, symptoms and voice notes are encrypted with AES-256-GCM. |
| Data sent to AI | Names, emails and phone numbers are redacted before Gemini sees free text. |
| Over-sharing within a family | Role-based permissions plus per-member visibility chosen by the elder. |
| Duplicate or lost reminders | Deterministic job ids, transactional claims with a lease, bounded retries. |
| Secrets | Secret Manager in production; the app refuses to start without them. |

Details: [SECURITY.md](SECURITY.md).

## Run locally

Requires Node.js 22.

```bash
npm install
cp .env.example .env.local   # optional: works with no keys at all
npm run dev
```

Open http://localhost:3000/demo. Without keys, data is kept in memory, emails are printed to the log, and AI features show a manual fallback.

```bash
npm test          # 72 unit and integration tests (Vitest)
npm run lint      # ESLint incl. jsx-a11y strict
npm run typecheck
npm run build
```

## Deploy to Cloud Run

You need the [gcloud CLI](https://cloud.google.com/sdk/docs/install), a Google Cloud project with billing, a [Gemini API key](https://aistudio.google.com/apikey) and a [Gmail App Password](https://myaccount.google.com/apppasswords).

```bash
gcloud auth login
export PROJECT_ID=your-project REGION=asia-south1
export GEMINI_API_KEY=... SMTP_USER=you@gmail.com SMTP_PASS=your-app-password
export DEMO_INBOX=you@gmail.com   # demo emails arrive as you+caretaker@gmail.com etc.
bash scripts/deploy.sh
```

The script enables the APIs, creates Firestore with its indexes, a least-privilege service account, the secrets, the Cloud Run service and the Cloud Scheduler job. It is safe to re-run.

## Host on Vercel or Render

Both use the same Firestore database through Firebase's free Spark plan, which needs no card.

**1. Firestore (Firebase console)**
1. At [console.firebase.google.com](https://console.firebase.google.com), create a project and open **Build → Firestore Database → Create database** (production mode, region `asia-south1`).
2. Under **Indexes → Composite → Create index**, add two indexes on collection `jobs`: `status` ↑ + `dueAt` ↑, and `status` ↑ + `leaseUntil` ↑.
3. Under **Project settings → Service accounts → Generate new private key**, download the JSON key. Keep it out of the repo; it goes into `GOOGLE_CREDENTIALS`.

**2. Environment variables**

| Variable | Value |
|---|---|
| `DATA_BACKEND` | `firestore` |
| `GOOGLE_CREDENTIALS` | the whole service-account JSON |
| `ENCRYPTION_KEY` | `openssl rand -base64 32`, **the same on every host** |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | your key, `gemini-3-flash-preview` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Gmail App Password settings (Vercel only, see below) |
| `DEMO_MODE`, `DEMO_INBOX` | `true`, your Gmail address |

`APP_URL` is optional: the app reads the address Vercel or Render publishes.

**3. Deploy**
- **Vercel:** *Add New → Project*, import the repo, paste the variables, deploy. No other settings are needed.
- **Render:** *New → Blueprint*, pick the repo. [`render.yaml`](render.yaml) builds the Dockerfile on the free plan and asks for the secret values.

**4. Reminders.** Free plans on both hosts cannot run a job every minute, so use [cron-job.org](https://cron-job.org) (free):
- URL `https://<your-vercel-app>/api/cron/tick`, every minute, method POST, header `Authorization: Bearer <CRON_SECRET>`.
- Optional: a second job calling `https://<your-render-app>/api/health` every 10 minutes keeps the free Render instance from sleeping.

Render's free plan blocks outgoing email ports, so let Vercel run the reminder engine and send email. Both hosts share the database, and jobs are claimed in transactions, so a reminder is never sent twice. Cloud Text-to-Speech needs Google Cloud billing; without it the elder's phone voice is used.

## Project layout

```
src/app/            pages and API routes
src/components/     UI (elder, care, family, shared)
src/lib/            domain rules, services, auth, AI, database
tests/              Vitest suites
scripts/deploy.sh   one-command Cloud Run deployment
```

## Medical disclaimer

VridhaSuraksha helps families keep track of medicines. It does not give medical advice, diagnose or replace a doctor or pharmacist. AI explanations and prescription scans can be wrong and must be checked against the prescription. In an emergency call **112**.
