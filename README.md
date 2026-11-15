# VridhaSuraksha (वृद्धसुरक्षा)

> **"Dadaji stays in charge. The family stays in the loop."**
> 
> *A dignity-first elderly care and intelligent medication companion built for the PromptWars x Catalyst (Google for Developers, Build with AI) hackathon.*

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Production-black?logo=vercel)](https://vridhasuraksha.vercel.app/)
[![Render Deployment](https://img.shields.io/badge/Render-Fallback%20Live-46E3B7?logo=render)](https://vridhasuraksha.onrender.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3%20Flash%20Preview-4285F4?logo=google)](https://deepmind.google/technologies/gemini/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5%20App%20Router-000000?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon%20PostgreSQL-00E599?logo=postgresql)](https://neon.tech/)
[![Vitest](https://img.shields.io/badge/Tests-82%2F82%20Passing-6E9F18?logo=vitest)](https://vitest.dev/)
[![Code Quality](https://img.shields.io/badge/Code%20Quality-A%2B%20%2F%20Clean%20Architecture-blue)](ARCHITECTURE.md)

---

## Live Deployments & Interactive Demo

- **Primary Production URL (Vercel):** [https://vridhasuraksha.vercel.app/](https://vridhasuraksha.vercel.app/)
- **Fallback Production URL (Render):** [https://vridhasuraksha.onrender.com/](https://vridhasuraksha.onrender.com/)
- **1-Click Demo Sandbox:** [https://vridhasuraksha.vercel.app/demo](https://vridhasuraksha.vercel.app/demo)
- **GitHub Repository:** [https://github.com/KunalKushwaha1806/VrishaSuraksha](https://github.com/KunalKushwaha1806/VrishaSuraksha)

---

## Medical Disclaimer

> [!IMPORTANT]
> **VridhaSuraksha supports daily health routines, medication logging, and family coordination. It does not provide medical diagnosis, treatment recommendations, or replace professional consultation with a qualified doctor or pharmacist. Always consult a licensed healthcare provider regarding health conditions, medication changes, or physical symptoms.**

---

## Core Implemented Capabilities

### 1. Dadaji-First Accessible UI & Bilingual Voice Logging
- **Senior-Optimized Interface**: High-contrast, large touch targets (64px minimum), clear status indicators, and zero cognitive overload.
- **Bilingual Voice Logging**: Dadaji can log doses via speech recognition in Hindi (*"Maine le li"*, *"Maine dawai le li"*) or English (*"I took it"*).
- **Personal Touch**: Plays custom recorded voice notes from grandchildren or family members when medications are due.

### 2. Google Gemini 3 Flash Vision & Prescription Diff Engine
- **Multimodal OCR**: Powered by Google Gemini (`gemini-3-flash-preview` via `@google/genai`) to scan handwritten or printed physical prescriptions.
- **Intelligent Diff Engine**: Compares newly extracted medications against existing Prisma schedules to detect changes (*Added*, *Modified dosage/frequency*, or *Discontinued*).
- **Human-in-the-Loop Confirmation**: Previews all schedule diffs with clear visual badges before updating active schedules.

### 3. Plain-Language AI Explainer (Audio & Text)
- **Accessible Explanations**: Dadaji can tap *"What is this medicine for?"* (`/api/explain`) to get concise, non-jargon explanations in Hindi or English.
- **Speech Synthesis**: Synthesizes the explanation aloud using the browser's Web Speech API.
- **Safety Disclaimer**: Every explanation concludes with a mandatory reminder to confirm with a doctor or pharmacist.

### 4. Workerless Background Escalation Engine
- **Zero Redis / Zero BullMQ Overhead**: Runs entirely on serverless architecture via `GET /api/cron/tick`, triggered every 60 seconds by an external HTTPS cron pinger (`cron-job.org`) with `Authorization: Bearer <CRON_SECRET>`.
- **Three-Tier Escalation Ladder**:
  1. **Dose Due**: Proactive reminder sent to Dadaji.
  2. **+15 Minutes**: Gentle follow-up check.
  3. **+30 Minutes**: Escalated alert delivered to designated Family Circle members.
- **Idempotent Scheduling**: Unique constraint on `[doseId, kind, dueAt]` ensures no duplicate notifications are ever sent.

### 5. Single-Use Signed Action Tokens
- **One-Tap Safe Actions**: Email alerts contain cryptographic, signed action tokens (`/a/[token]`).
- **Antivirus Safe**: `GET` requests only load a clean confirmation screen; mutating actions require an explicit button click to prevent email link scanners from falsely marking doses as taken.
- **Single-Use Enforcement**: Tokens expire after 24 hours and are invalidated immediately upon first use.

### 6. Dignity & Privacy-Centric Family Circle
- **Streaks, Not Guilt**: Tracks consecutive days of adherence without shame or intrusive surveillance.
- **Heart Reactions**: Family members can send gentle encouragement and love taps without nagging.
- **Refill Coordination**: When medication stock runs low, family members can tap *"I'll handle it"* to claim refills and keep everyone in sync.
- **Granular Elder Consent**: Dadaji controls what each circle member can see (e.g., share appointment times while keeping private medical notes confidential).

### 7. Doctor Consultation Brief (`/app/brief`)
- Consolidates 7-day adherence percentages, missed dose reasons, recorded symptoms, and doctor notes into a clean, printable one-page brief for hospital and clinic visits.

### 8. PWA & Offline-First Resilience
- Progressive Web App with manifest and service worker caching.
- If connectivity drops, dose confirmations are safely queued in `localStorage` and automatically synchronized to PostgreSQL once reconnected.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Clients["User Surfaces"]
        D["Dadaji (Accessible PWA / Voice)"]
        C["Caretaker (Scheduler / Prescription Scan)"]
        F["Family Circle (Adherence / Refill Claims)"]
    end

    subgraph Edge["Hosting & Routing"]
        V["Vercel (Primary Edge Next.js 15 App)"]
        R["Render (Fallback Container Web Service)"]
        CRON["cron-job.org (1-Minute HTTPS Tick)"]
    end

    subgraph Server["Serverless Application Layer"]
        AUTH["Pure-JS Auth (JWT / bcryptjs)"]
        API_CRON["/api/cron/tick (Workerless Engine)"]
        API_AI["/api/explain & /api/scan (Gemini Vision & LLM)"]
        ACTIONS["/a/[token] (Signed Action Tokens)"]
    end

    subgraph Integrations["Cloud Services"]
        GEMINI["Google Gemini 3 Flash (`@google/genai`)"]
        NEON["Neon PostgreSQL (Serverless Pooler)"]
        RESEND["Resend API (HTTPS Transactional Email)"]
    end

    D & C & F --> V
    D & C & F -.->|Failover| R
    CRON -->|Bearer CRON_SECRET| API_CRON

    V --> Server
    R --> Server

    API_AI --> GEMINI
    Server -->|Prisma ORM| NEON
    API_CRON --> RESEND
    ACTIONS -->|Single-Use Verify| NEON
```

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

Detailed security architecture: [SECURITY.md](file:///c:/Users/Kunal%20Kushwaha/OneDrive/Desktop/Project/VrishaSuraksha/SECURITY.md).  
Architecture & engineering standards: [ARCHITECTURE.md](file:///c:/Users/Kunal%20Kushwaha/OneDrive/Desktop/Project/VrishaSuraksha/ARCHITECTURE.md).

---

## Production Deployment Guide

### Target 1: Vercel (Primary)

1. **Database Setup**:
   - Provision a PostgreSQL database at [neon.tech](https://neon.tech).
   - Copy the pooled connection string (`postgresql://...pooler.../neondb?sslmode=require`).

2. **Deploy on Vercel**:
   - Import the GitHub repository into [Vercel](https://vercel.com).
   - Configure the environment variables:
     ```env
     DATABASE_URL="postgresql://user:pass@ep-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
     GEMINI_API_KEY="AIzaSy..."
     GEMINI_MODEL="gemini-3-flash-preview"
     RESEND_API_KEY="re_..."
     EMAIL_FROM="VridhaSuraksha <onboarding@resend.dev>"
     JWT_SECRET="<openssl rand -base64 48>"
     CRON_SECRET="<openssl rand -base64 48>"
     ENCRYPTION_KEY="<openssl rand -base64 32>"
     APP_URL="https://vridhasuraksha.vercel.app"
     DATA_BACKEND="prisma"
     ```
   - Click **Deploy**. The build script automatically executes `prisma generate && node scripts/migrate.mjs && next build`.

3. **Background Scheduler Setup**:
   - Create a free job on [cron-job.org](https://cron-job.org):
     - **URL**: `GET https://vridhasuraksha.vercel.app/api/cron/tick`
     - **Interval**: Every 1 minute (`* * * * *`)
     - **Headers**: `Authorization: Bearer <YOUR_CRON_SECRET>`

---

### Target 2: Render (Fallback)

1. Connect the repository to [Render](https://render.com) using the provided `render.yaml` Blueprint or create a **Web Service**:
   - **Environment**: Node
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
2. Configure the identical environment variables in the Render dashboard.

---

## Local Development & Quality Gates

```bash
# 1. Install dependencies
npm install

# 2. Setup local environment
cp .env.example .env.local
# (Runs immediately out-of-the-box in mock mode with zero external keys required)

# 3. Generate Prisma client
npx prisma generate

# 4. Start local development server
npm run dev
```

Visit `http://localhost:3000/demo` to access the interactive role switcher.

### Automated Test Suite & Quality Verification

```bash
npm test              # 82 unit and integration tests passing via Vitest
npm run lint          # Strict ESLint checks (0 warnings, 0 errors)
npm run typecheck     # TypeScript compiler verification (0 errors, strict flags)
npm run format:check  # Prettier formatting verification across all source files
npm run build         # Next.js optimized production build
```

---

## Guided End-to-End Demo Script

| Step | Persona | Action | Behind the Scenes |
|---|---|---|---|
| **1** | Caretaker (Sunita) | Upload prescription photo at `/app/scan` | Gemini 3 Flash Vision extracts medicines; diff algorithm tags additions/changes for review. |
| **2** | Elder (Dadaji) | View pending dose on large-button UI at `/app` | Clean, high-contrast display with zero clutter. |
| **3** | Elder (Dadaji) | Tap *"What is this medicine for?"* | Gemini explains in Hindi/English; Web Speech speaks aloud. |
| **4** | Elder (Dadaji) | Speak *"Maine le li"* or tap Green button | Voice recognition parses input; dose is recorded as `TAKEN` instantly. |
| **5** | Elder (Dadaji) | Tap *"Missed"* and select *"Ran out"* | Triggers automated refill alert; dose flagged as missed with reason. |
| **6** | Family (Arjun) | View low-stock banner and tap *"I'll handle it"* | Claim atomically updates database; prevents multiple family members from double-ordering. |
| **7** | Family (Riya) | Tap **Heart** reaction on Dadaji's profile | Sends positive affirmation and logs streak encouragement without intrusive notifications. |
| **8** | Elder (Dadaji) | Adjust privacy toggles in `/app/settings` | Granular flags update permissions in real time; audited in `/app/activity`. |
| **9** | Caretaker / Doctor | Open and print `/app/brief` | Generates a concise, single-sheet clinical summary with adherence %, missed reasons, and symptoms. |
