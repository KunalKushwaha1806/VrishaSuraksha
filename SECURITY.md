# Security Policy — VridhaSuraksha

## Medical Disclaimer

> **IMPORTANT**: VridhaSuraksha supports daily routines and medication tracking. It does **not** replace medical advice, diagnosis, or care from a qualified doctor or pharmacist. Always consult a healthcare professional regarding medication adjustments or health symptoms.

## Reporting Vulnerabilities

Please report security vulnerabilities privately via GitHub Security Advisories rather than through public issues or pull requests.

---

## 1. Access Control & Authentication
- **Passcode Hashing**: All user and invite passcodes are hashed using `bcryptjs` with cost factor 12. Plaintext passcodes are never persisted or logged.
- **Rate Limiting & Lockout**: Passcode and login attempts are strictly rate-limited per IP and per circle. Accounts enter an exponential lockout window after repeated failed attempts. Constant-time comparisons (`crypto.timingSafeEqual`) prevent timing side-channel attacks on circle lookups and credentials.
- **Server-Side Enforcement**: Caller role and circle membership are validated server-side on every API route via `requireRole()` and the centralized `route()` wrapper. Client assertions are never trusted.
- **Immediate Revocation**: The elder (circle owner) can revoke any member or caretaker immediately; sessions are re-validated on every request against active circle records.
- **Audit & Activity Logging**: Every administrative, sensitive, and data-modifying action (including viewing emergency QR cards, diffing prescriptions, and logging doses) is recorded in an immutable `ActivityLog` accessible to the elder.

---

## 2. Data Protection at Rest & In Transit
- **Transport Security**: HTTPS only. Enforced via HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
- **Field-Level Encryption at Rest**: Sensitive healthcare fields (doctor notes, symptom diary entries, medical instructions, and voice notes) are encrypted at rest with AES-256-GCM using `ENCRYPTION_KEY` (a 32-byte base64 key).
- **Secrets Management**: All secrets (`DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `ENCRYPTION_KEY`, `RESEND_API_KEY`, `GEMINI_API_KEY`) reside exclusively in environment variables. Zero credentials are committed to source control.
- **Ephemeral Processing**: Prescription images are decoded and resized in browser memory, scanned in memory on serverless routes, and never written to disk or database.

---

## 3. Safe & Grounded AI Use
- **Advisory Only**: All Gemini responses are treated strictly as advisory suggestions requiring explicit human confirmation before taking effect.
- **No Diagnosis or Dosing**: Strict system prompts prevent Gemini from prescribing, altering dosages, or diagnosing conditions.
- **Schema Validation with Zod**: Every AI output is validated against strict JSON schemas with Zod. Malformed outputs are rejected with automatic single-retry and manual fallback.
- **PII Sanitization & Redaction**: Only sanitized medicine names and anonymized medical bullet facts are sent to Gemini. Names, emails, and phone numbers are completely redacted prior to AI invocation.
- **Prompt Injection Defense**: All OCR/vision text extracted from prescription photos and patient inputs is tagged as data, never as instructions.

---

## 4. Sessions, Cookies & API Hardening
- **Secure Sessions**: Short-lived JWTs (HS256) stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- **Parameterized Queries**: All database queries are executed via Prisma ORM parameterized queries or sanitized key-value mappings. No raw SQL string interpolation.
- **XSS & CSRF Prevention**: No `dangerouslySetInnerHTML`. Mutating API routes enforce origin verification matching `expectedHost`. Dynamic per-request CSP nonces with `strict-dynamic` prevent inline script injection.
- **Security Headers**: Configured in `next.config.ts`:
  - `Content-Security-Policy` with nonces
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=()`
  - `Cross-Origin-Opener-Policy: same-origin`
- **Payload Limits**: Request body sizes are strictly capped (e.g. 32 KB for JSON routes, 600 KB for compressed voice notes, 2.2 MB for resized prescription photos).

---

## 5. Granular Privacy & Consent Controls
- **Per-Member Visibility**: The elder defines granular visibility permissions per family member:
  - Doses history
  - Missed-dose reasons
  - Symptoms & side-effects
  - Appointments
  - Medication stock
- **Emergency QR Sharing**: Emergency cards use unguessable 32-byte random tokens with expiration timestamps, read-only views, and one-tap revocation.
- **Consent Logging**: Every modification of member visibility is tracked in a dedicated `ConsentLog`.
- **GDPR / Privacy Compliance**: Elders can execute full JSON data export (`/api/export`) or permanent circle deletion (`DELETE /api/circle`).

---

## 6. Escalation Reliability & Exactly-Once Delivery
- **No Duplicate Emails**: Scheduled jobs have unique constraints on `[doseId, kind, dueAt]`.
- **Transactional Claims**: `/api/cron/tick` claims jobs in atomic database transactions with lease timeouts.
- **Recipient Tracking**: Every emailed recipient is logged in `sentTo` before completing a step; retries after partial failure never re-email the same person.
- **Single-Use Action Links**: One-tap action links from emails use signed JWTs with unique `jti` recorded upon first use.
