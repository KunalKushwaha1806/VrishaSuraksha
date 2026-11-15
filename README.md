# VridhaSuraksha

> **Dadaji stays in charge. The family stays in the loop.**

An elderly care and medication management platform built for the **PromptWars x Catalyst (Google for Developers, Build with AI)** hackathon. VridhaSuraksha creates a shared, passcode-protected ecosystem where an elder, caretakers, and family manage medication schedules, track adherence, monitor doctor appointments, and receive proactive email reminders — keeping the elderly person at the center of their healthcare decisions.

---

## Medical Disclaimer

> **IMPORTANT**: VridhaSuraksha supports daily routines and medication tracking. It does **not** replace medical advice, diagnosis, or care from a qualified doctor or pharmacist. Always consult a healthcare professional regarding medication adjustments or health symptoms.

---

## Hard Constraints & Architecture

- **Deploy Target**: Vercel (Primary) & Render (Fallback). Single repo, zero manual server configuration.
- **Framework**: Next.js 15+ (App Router) with TypeScript & React 19.
- **Database**: PostgreSQL on Neon or Supabase via Prisma ORM (`prisma generate && prisma migrate deploy && next build`).
- **Background Workerless Engine**: Zero long-running workers, zero Redis/BullMQ. Background execution is handled through `GET /api/cron/tick` pinged every minute with `Authorization: Bearer <CRON_SECRET>`.
- **Pure HTTPS Email**: Resend over HTTPS (Render-friendly; no blocked SMTP ports).
- **AI Integration**: Google Gemini (`gemini-2.5-flash`) via `@google/genai` called exclusively on server routes (`export const maxDuration = 30`).
- **Pure-JS**: Pure-JS libraries only (`bcryptjs`, `jose`). No native binary dependencies.
- **Timezone**: All timestamps stored in UTC and displayed in `Asia/Kolkata` (IST).
- **PWA**: Installable PWA manifest with offline dose logging that queues in `localStorage` and syncs upon reconnection.

---

## Threat Model & Security Controls

| Threat | Risk | Mitigation in VridhaSuraksha |
|---|---|---|
| **Passcode Brute-Forcing** | Unauthorized circle entry | `bcryptjs` (cost 12), per-IP rate limiting, and an exponential account lockout after 5 failures in 15 minutes. Constant-time checks prevent timing attacks. |
| **Session Hijacking / CSRF** | Impersonation of caretakers | Signed HS256 JWTs stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies with strict `Origin` verification on mutating routes. |
| **XSS & Injection** | Malicious script execution | Per-request CSP nonce with `strict-dynamic`; zero `dangerouslySetInnerHTML`; Prisma parameterized queries prevent SQL injection. |
| **Over-Sharing / Privacy Leak** | Family overreach into private medical notes | Role-Based Access Control (`requireRole()`) and elder-controlled per-member visibility flags (`doses`, `missedReasons`, `symptoms`, `appointments`, `stock`). |
| **Medical Data Exposure at Rest** | Database breach exposing notes & symptoms | Sensitive fields (medical notes, symptom logs, voice notes) are encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY`. |
| **Prompt Injection & AI Hallucination** | Malicious text in prescriptions altering dosage | Prescription text is treated as data, never instructions. AI outputs are strictly validated against Zod schemas; diffs require human confirmation before applying. |
| **Email Scanner Side-Effects** | Antivirus link scanner auto-logging doses | Single-use signed action tokens (`/a/[token]`). GET loads the confirmation page; dose is only logged upon deliberate button press. |
| **Duplicate Reminder Flooding** | Multiple emails for same dose | Unique constraint on `[doseId, kind, dueAt]` in `ScheduledJob`. Atomic transactional claims and per-member `sentTo` tracking. |

Details: [SECURITY.md](file:///c:/Users/Kunal%20Kushwaha/OneDrive/Desktop/Project/VrishaSuraksha/SECURITY.md).

---

## 1-Page Deployment Guide

### Option 1: Vercel (Primary)

1. **Create Neon Database**:
   - Create a free Postgres database at [neon.tech](https://neon.tech).
   - Copy the connection string (`postgresql://...`). Make sure to use the pooled connection string.

2. **Deploy to Vercel**:
   - Push this repo to GitHub and import it into [Vercel](https://vercel.com).
   - In **Project Settings > Environment Variables**, add:
     ```env
     DATABASE_URL="postgresql://user:pass@ep-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
     GEMINI_API_KEY="AIzaSy..."
     RESEND_API_KEY="re_..."
     EMAIL_FROM="VridhaSuraksha <onboarding@resend.dev>"
     JWT_SECRET="<openssl rand -base64 48>"
     CRON_SECRET="<openssl rand -base64 48>"
     ENCRYPTION_KEY="<openssl rand -base64 32>"
     APP_URL="https://your-vercel-domain.vercel.app"
     DATA_BACKEND="prisma"
     ```
   - Click **Deploy**. The build script runs `prisma generate && prisma migrate deploy && next build`.

3. **Configure 1-Minute Cron**:
   - Go to [cron-job.org](https://cron-job.org) (free).
   - Create a cron job:
     - **URL**: `GET https://your-vercel-domain.vercel.app/api/cron/tick`
     - **Schedule**: Every 1 minute (`* * * * *`)
     - **Header**: `Authorization: Bearer <YOUR_CRON_SECRET>`

4. **Seed Demo Data**:
   - Run `npm run seed` locally with `DATABASE_URL` set, or click **Reset demo circle** in `/demo`.

---

### Option 2: Render (Fallback)

1. Connect the repository in Render as a **Web Service**.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm start`
4. Add the same environment variables. The 1-minute `cron-job.org` pinger keeps Render's free tier continuously awake.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# (Optional: Works immediately with zero keys using in-memory mode!)

# 3. Generate Prisma client
npx prisma generate

# 4. Start local development server
npm run dev
```

Visit `http://localhost:3000/demo` to log in as Dadaji, Caretaker Sunita, or Family Members Arjun / Riya.

### Running Tests & Quality Checks
```bash
npm test            # 82 unit and integration tests (Vitest)
npm run lint        # ESLint check
npm run typecheck   # TypeScript check
npm run build       # Next.js production build test
```

---

## End-to-End Demo Script Walkthrough

Follow this scripted flow to demonstrate VridhaSuraksha:

1. **Prescription Change Detector**:
   - Log in as **Caretaker (Sunita)** at `/demo`.
   - Go to **Scan Prescription** (`/app/scan`).
   - Upload a prescription photo. Gemini Vision extracts the medicines and code calculates the diff against stored schedules (e.g. *Added*, *Changed*, *Stopped*).
   - Review and confirm to apply.

2. **Elder Voice-First Screen & AI Explainer**:
   - Switch to **Elder (Dadaji)** at `/app`.
   - Dadaji's high-contrast, large-button interface displays the next pending dose.
   - Tap **"What is this medicine for?"** (`/api/explain`). Gemini delivers a plain-language explanation in Hindi or English, and browser SpeechSynthesis speaks it aloud.
   - Always concludes with: *"Please confirm with your doctor or pharmacist."*

3. **Family Voice Reminder & Voice Logging**:
   - A grandchild's voice note plays when Dadaji's dose is due.
   - Tap the microphone button and say *"Maine le li"* (or *"I took it"*).
   - Dose is instantly marked `TAKEN`.

4. **Missed-Dose Triage & Refill Claiming**:
   - Dadaji taps **"Missed"** and selects **"Ran out"** (`ran_out`).
   - Stock drops to zero and an urgent refill notification is triggered.
   - Log in as **Family (Arjun)** at `/app`.
   - Tap **"I'll handle it"** on the refill banner. All family members see that Arjun has claimed it.

5. **Streaks, Not Guilt & Heart Reactions**:
   - The Family dashboard displays Dadaji's active day streak (computed purely from dose logs).
   - Family taps the **Heart** button to send love without nagging.

6. **Privacy Controls & Activity Logging**:
   - Log in as Dadaji, open **Circle Settings** (`/app/settings`).
   - Change permissions for a family member (hide missed reasons).
   - Check the **Activity Log** (`/app/activity`) to see real-time consent changes and audit history.

7. **Pre-Appointment Doctor Brief**:
   - Navigate to `/app/brief`.
   - View the generated one-page doctor brief consolidating 7-day adherence %, missed doses, reported symptoms, and doctor notes.
   - Tap **Print Brief** for a doctor consultation.
