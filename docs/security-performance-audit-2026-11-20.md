# Security, reliability and performance audit — 20 November 2026

Scope: the whole application (auth, server actions, API routes, webhooks, file handling, configuration), reviewed as a penetration tester would: looking for authorisation gaps, injection, unsafe redirects, session handling, abuse of paid services, and production-only failures. Payment webhooks (Paga, provider, attribution) were reviewed and found sound: signatures are verified with constant-time comparison, events are idempotent, and amounts are cross-checked against Paga's authenticated status API.

## Vulnerabilities fixed

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High | **Stored XSS via links.** Every user-supplied URL (portfolio, deliverable evidence, trust evidence, assessments, campaign content, organisation website, campaign landing page) accepted `javascript:` and `data:` URLs, which were then rendered as clickable links to other users and staff. | New `httpUrl()` / `optionalHttpUrl()` validators (`src/server/validation.ts`) accept only http(s). Links read back from the database are passed through `safeExternalHref()` (`src/lib/safe-href.ts`) so rows saved before the fix cannot render either. |
| 2 | High | **Account takeover through Google sign-in.** When email verification was off, a Google identity whose email was *not* verified by Google was linked to an existing password account with the same address, and marked verified. | Google sign-in only links to an existing account when Google reports `email_verified: true`. New Google accounts are only marked verified when Google says so. |
| 3 | High | **Sessions survived a password reset.** JWT sessions stayed valid for up to 8 hours after a reset, so someone who had stolen a session kept access. | Sessions carry a keyed fingerprint of the password hash (`src/server/session-fingerprint.ts`); `requireUser`, the file download route, consent and onboarding reject sessions whose fingerprint no longer matches. A reset signs out every other session. |
| 4 | Medium | **Same-side approvals.** A second member of the business could accept, decline or counter an offer written by their own colleague, and accept their own side's change request, so terms could be "agreed" without the specialist (or vice versa). | Offers, counters, declines and change-request responses now require the *other* party (`app/workspace/engagements/actions.ts`, `app/workspace/projects/delivery-actions.ts`). |
| 5 | Medium | **Project and file access for declined invitees.** A professional whose invitation was declined or cancelled could still open the project once it was completed or cancelled, and download its private files (deliverables, messages, dispute evidence) through `/api/files`. | `getProjectAccess` now grants professionals access only while negotiating during matching, or when they are delivering / delivered the work. Covered by a new test. |
| 6 | Medium | **Unlimited AI usage.** The scope planner, AI brief generation and profile suggestions had no per-account limit, so one account could run up the AI provider bill. | 30 AI requests per account per hour (`allowAiRequest` in `src/server/rate-limit.ts`). |
| 7 | Medium | **No Content-Security-Policy.** | CSP added in `next.config.ts`: same-origin scripts, styles, fonts and connections only; no plugins, frames or framing (`frame-ancestors 'none'`); forms only to this site and Google sign-in; `upgrade-insecure-requests` in production. Also added Cross-Origin-Resource-Policy, a stricter Permissions-Policy and a 2-year HSTS. |
| 8 | Low | Referral redirect followed whatever landing URL was stored. | Redirects only to http(s) landing pages; referral codes are format-checked before the database is queried. |
| 9 | Low | Notification email links accepted `//host` paths (protocol-relative, i.e. another site). | Only same-site paths are used. |
| 10 | Low | File downloads with non-Latin file names produced an invalid `Content-Disposition` header (download failed). | ASCII fallback plus RFC 5987 UTF-8 file name; file ids are format-checked. |
| 11 | Low | Signing in with a password on a Google-only account could throw a server error. | Treated as a normal failed sign-in. |

## Features that did not work in production (Vercel) — fixed

- **All file uploads failed.** Uploads were written to the server's local disk, which is read-only and not shared between instances on Vercel. Added a database storage adapter (`StoredObject` table). It is used automatically on Vercel; `PRIVATE_STORAGE_DRIVER=local` keeps the disk adapter for Docker. Uploads are capped at 4 MB on Vercel because Vercel rejects larger request bodies.
- **Notification emails were mostly never sent.** They were dispatched as fire-and-forget promises, which Vercel freezes as soon as the response returns. They now use `after()`, which keeps the function alive until delivery finishes.
- **Task-due reminders never ran.** Nothing called `/api/jobs/notifications`. Added a daily Vercel Cron (`vercel.json`) and GET support; it authenticates with `CRON_SECRET` (sent automatically by Vercel) or the existing `JOB_SECRET`.

## Performance

- **Smaller client bundle on every workspace page.** The sidebar imported icons from the `@phosphor-icons/react` barrel; `optimizePackageImports` now ships only the icons used.
- **Half the auth work per page.** `requireUser` is wrapped in React `cache()`, so the layout and page share one session decode and one database read instead of two each.
- **Instant navigation feedback.** `app/workspace/loading.tsx` shows a skeleton immediately while the server renders, instead of the page appearing frozen.
- **Faster sign-up and organisation creation.** Paga account provisioning now runs after the response instead of blocking it.
- **Database indexes** for 18 foreign keys that project, profile, campaign and file queries filter on (migration `20261120090000_foreign_key_indexes`).

## Required after deploying

1. Run the **Apply database migrations to Neon** GitHub workflow. Until it runs, uploads fail because the `StoredObject` table does not exist.
2. In Vercel → Settings → Environment Variables, add `CRON_SECRET` (a random string of at least 16 characters) so the daily reminder job can authenticate.
3. Optional: set `NEXT_PUBLIC_UPLOAD_MAX_MB` if you change `UPLOAD_MAX_MB` on a non-Vercel host, so the upload hint matches.

## Verification

- `tsc --noEmit`: clean. `eslint .`: 0 errors.
- `npm run test`: all existing tests plus a new `src/server/security-audit.test.ts` (link validation, session fingerprint, database storage driver, project access for declined/invited professionals) pass against a local Postgres.
- New migrations apply cleanly with `prisma migrate deploy`.
- `next build` succeeds.

## Not changed (recommendations)

- Rate limiting reads the first `X-Forwarded-For` value. That is correct behind Vercel, which overwrites the header; behind another proxy, make sure it does the same.
- Upload malware scanning is still not implemented (see the November 18 gap audit).
- A nonce-based CSP would allow removing `'unsafe-inline'` for scripts; it requires middleware and makes every page dynamic, so it was not done here.
