# Architecture & Engineering Standards — VridhaSuraksha

> **"Dadaji stays in charge. The family stays in the loop."**
> 
> *Comprehensive guide to software architecture, design patterns, domain models, code quality gates, and maintainability standards.*

---

## 1. Architectural Philosophy: Clean & Domain-Driven Architecture

VridhaSuraksha follows **Clean Architecture** and **Domain-Driven Design (DDD)** principles to maintain strict separation of concerns, high testability, and zero vendor lock-in.

```
┌─────────────────────────────────────────────────────────────┐
│                 Presentation Layer (UI & API)               │
│  - Next.js 15 App Router (/app, /api, Server/Client UI)     │
│  - Accessible components (src/components/ui.tsx)            │
│  - Safe Action token confirmation screens (/a/[token])      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                  Service / Application Layer                │
│  - Orchestration & transactional workflows                  │
│  - Dose logging, escalation engine, appointment management  │
│  - Path: src/lib/services/                                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Domain Layer (Pure Logic)                │
│  - Deterministic calculations: schedule diffs, adherence %  │
│  - Permission matrices, double-dose safety checks           │
│  - Path: src/lib/domain/ (Zero I/O, 100% unit testable)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 Infrastructure & Persistence                │
│  - Port-and-Adapter storage abstraction (src/lib/db/)       │
│  - Neon Serverless PostgreSQL via Prisma ORM                │
│  - Google Gemini 3 Flash SDK & Resend HTTPS Email Driver    │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets:
1. **Pure Domain Logic (Zero Side-Effects)**:
   - Business calculations (adherence calculation, streak rules, double-dose detection, prescription diffing, permission enforcement) live in `src/lib/domain/` as pure, deterministic functions without network or database dependencies.
   - These are tested with 100% isolation in Vitest without needing database stubs or mock servers.
2. **Port-and-Adapter Database Abstraction**:
   - Defined in `src/lib/db/types.ts` via the `Db` interface.
   - Implemented via Prisma (`src/lib/db/prisma.ts`), Firestore (`src/lib/db/firestore.ts`), and Memory (`src/lib/db/memory.ts`).
   - The application layer interacts only with the abstract `Db` interface, decoupling core features from specific database engines.
3. **Pure-JS Portability**:
   - Zero native compilation dependencies. We use `bcryptjs` and `jose` (pure JavaScript/Web Crypto) to guarantee instant, seamless deployment across Vercel Edge/Serverless and standard Node runtimes.

---

## 2. Code Quality & Engineering Best Practices

### Zero-`any` & Strict Typing Policy
- Strictest TypeScript compiler configuration:
  ```json
  "strict": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true
  ```
- No loose `any` casts in application code. All data schemas are statically and dynamically typed using **Zod** (`src/lib/validation.ts`).
- Schema validation runs at boundaries (HTTP requests, AI responses, action token payloads) before reaching domain logic.

### Centralized Declarative Route Wrapper (`src/lib/http.ts`)
Instead of duplicating boilerplate authentication, rate-limiting, and error handling across 25+ Next.js route handlers, all mutating endpoints utilize the centralized higher-order `route()` wrapper:

```typescript
export const POST = route(
  {
    role: "caretaker",          // RBAC enforcement
    body: scheduleSchema,       // Automatic Zod payload validation
    perMinute: 30,              // Automatic per-IP rate limiting
  },
  async ({ auth, body }) => {
    // Pure business logic: inputs are guaranteed safe, sanitized, and authorized
    return { ok: true, data: result };
  }
);
```

### Structured Error Handling
- Standardized `ApiError` class with stable, machine-readable error codes (`bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`).
- Catch-all middleware sanitizes internal stack traces in production to prevent information disclosure while emitting structured JSON logs (`src/lib/logger.ts`).

---

## 3. Resilience, Error Boundaries & Streaming

Next.js 15 App Router resilience is guaranteed by multi-tier error and loading boundaries:

| Boundary | Path | Purpose |
| :--- | :--- | :--- |
| **Global Error** | `src/app/global-error.tsx` | Catches catastrophic exceptions in the root layout; renders standalone HTML/body with reload action. |
| **Root Error** | `src/app/error.tsx` | Recovers from runtime rendering errors within page trees while preserving navigation. |
| **Workspace Error** | `src/app/app/error.tsx` | Handles workspace-level state issues without logging the user out. |
| **Root Loading** | `src/app/loading.tsx` | Accessible Suspense skeleton with polite screen reader announcements. |
| **Workspace Loading** | `src/app/app/loading.tsx` | Context-aware pulse skeletons matching Dadaji's high-contrast dashboard layout. |

---

## 4. Design Patterns in Use

1. **Factory Pattern**:
   - `getDb()` dynamically initializes and caches the active database adapter (`prisma`, `firestore`, or `memory`) based on environment configuration.
2. **Single-Use Action Token Pattern**:
   - High-privilege email reminder links issue a cryptographic JWT stored with a unique `jti` in the database. Tokens expire after 24 hours, require an explicit user click (preventing email scanner false triggers), and are invalidated atomically upon consumption.
3. **Escalation Ladder Pattern**:
   - Background dose reminders advance through discrete, deterministic states (`due` -> `reminder` -> `escalated`) without long-running worker processes, preventing double-notifications via atomic transactional claims.
4. **Human-in-the-Loop AI Pattern**:
   - Gemini Vision extracts medication regimens and generates diff proposals. The system renders side-by-side comparison badges (*Added*, *Changed*, *Stopped*) and requires explicit caretaker sign-off before modifying active records.

---

## 5. Automated Quality Gates

Every code change must pass four sequential verification gates:

```bash
# Gate 1: Unit & Integration Test Suite
npm test            # 133 automated Vitest specs across 18 test suites

# Gate 2: Static Analysis & Accessibility Linting
npm run lint        # ESLint with next/core-web-vitals & jsx-a11y/strict

# Gate 3: Strict TypeScript Type-Checking
npm run typecheck   # tsc --noEmit with strict flags

# Gate 4: Code Formatting Consistency
npm run format:check # Prettier validation against .prettierrc.json
```

---

## 6. Directory Structure Reference

```
src/
├── app/                  # Next.js 15 App Router pages, layouts, error boundaries, and API routes
│   ├── a/[token]/        # Safe single-use action token confirmation screen
│   ├── api/              # Secure serverless API endpoints wrapped via route()
│   ├── app/              # Authenticated workspace (elder, caretaker, family views)
│   ├── demo/             # 1-click interactive demo hub for evaluators
│   ├── global-error.tsx  # Root crash boundary
│   ├── loading.tsx       # Root Suspense streaming skeleton
│   ├── robots.ts         # Metadata crawling configuration
│   └── sitemap.ts        # Dynamic sitemap generator
├── components/           # Accessible, reusable UI design system
│   ├── care/             # Caretaker dashboard, prescription scanner, appointment manager
│   ├── elder/            # Dadaji voice-first interface, speech recognizer, AI explainer
│   ├── family/           # Family circle dashboard, heart reactions, voice note player
│   └── ui.tsx            # Foundation primitives (Button, Card, Badge, Notice, Field)
└── lib/                  # Core domain, business services, and infrastructure
    ├── ai/               # Google Gemini 3 Flash prompts, multimodal OCR, and explainer
    ├── auth/             # Pure-JS sessions, bcrypt hashing, cookies, and RBAC
    ├── client/           # Browser SpeechRecognition, speech synthesis, offline queue
    ├── db/               # Hexagonal database abstraction (Prisma, Firestore, Memory)
    ├── domain/           # Pure business logic (schedules, diffs, adherence, permissions)
    ├── services/         # Application orchestrators (doses, escalations, medications)
    ├── http.ts           # Centralized route() wrapper, rate limiting, and ApiError
    ├── logger.ts         # Structured JSON logging
    ├── models.ts         # Core TypeScript data contracts and domain types
    └── validation.ts     # Zod runtime schemas
```
