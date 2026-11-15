# Security

## Reporting

Please report vulnerabilities privately through GitHub's *Report a vulnerability* button on this repository rather than in a public issue.

## Design

**Authentication.** Each member joins with a one-time invite passcode, then signs in with the circle code, their email and a personal passcode. Passcodes are hashed with bcrypt (cost 12). Login is limited per IP, and a circle-code and email pair is locked for 15 minutes after 5 failures in 15 minutes; the lockout is stored in Firestore, so it survives restarts and spans instances. Unknown circles are checked against a dummy hash so timing does not reveal which accounts exist.

**Sessions.** A signed JWT (HS256, 7 days) in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. The member record is re-read on every request: a revoked member or a deleted circle is rejected immediately.

**Authorisation.** Every API route goes through one `route()` wrapper that checks the session, the role permission (`src/lib/domain/permissions.ts`), the request body schema (Zod), body size and rate limit. Family members see only what the elder has allowed for them.

**Request integrity.** Mutating `/api` requests must carry an `Origin` matching the app. A per-request CSP nonce with `strict-dynamic` is set on every page, together with HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a permissions policy and COOP.

**Email actions.** Buttons in emails are JWTs bound to one dose and one action, valid for 24 hours and usable once (the token id is recorded). A GET only shows a confirmation page; the action happens on POST.

**Data protection.** Free-text notes, symptoms and voice notes are encrypted with AES-256-GCM using a key from Secret Manager. Exports never contain passcode hashes. Free text is redacted of names, emails and phone numbers before it is sent to Gemini, and Gemini output is validated before use.

**Reminder engine.** `/api/cron/tick` requires `Authorization: Bearer <CRON_SECRET>`, compared in constant time. Jobs are claimed in a Firestore transaction with a lease, and each recipient is recorded so a retry never sends twice.

**Secrets.** Production secrets live in Secret Manager and are injected by Cloud Run. The app refuses to start in production if any required secret is missing. `.env*` files are git-ignored.

## Known limits

- The per-IP rate limiter is in memory per instance; the persistent lockout is the cross-instance guard.
- Voice notes are capped at 400 KB and 15 seconds and stored in Firestore, not Cloud Storage.
