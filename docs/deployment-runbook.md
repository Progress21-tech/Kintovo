# Deployment and technical handover

This is a deployment preparation guide, not a claim that the current repository has passed a production build. The source machine did not have Node.js available, so the Prisma client, schema, migration, lint, tests, and Next.js build have not been executed here.

## Required platform

- Node.js 22.18 or newer and npm. The Prisma 7 setup uses the Node runtime.
- PostgreSQL 15 or newer with TLS and automated backups.
- A hosting platform that supports Next.js 16 App Router, server actions, and Node.js route handlers.
- A stable HTTPS application origin and SMTP service before production registration and password recovery are enabled.
- Private object storage and malware scanning before private portfolio files or project deliverables are accepted.

## First database setup

Committed migrations are under `prisma/migrations`. Validate them against a disposable PostgreSQL database:

1. Copy `.env.example` to `.env` and set a local `DATABASE_URL`.
2. Install dependencies with `npm install`; commit the generated lockfile so deployment can use `npm ci`.
3. Run `npm run db:generate` and resolve any Prisma schema errors.
4. Apply committed migrations to a fresh database with `npm run db:migrate` in development.
5. Review future migration SQL and run the test/build commands.
6. Do not point `migrate dev` at production. Production releases should use `npm run db:deploy` after the migration has been reviewed and committed.

Back up any database with valuable data before schema changes.

## Environment configuration

Required server-only values:

- `DATABASE_URL`: production PostgreSQL URL; use least-privilege credentials and TLS.
- `AUTH_SECRET`: unique high-entropy secret stored in the hosting provider's secret manager.
- `AUTH_URL`: canonical HTTPS origin.
- `AUTH_TRUST_HOST`: set according to the trusted proxy/hosting deployment.
- SMTP settings and `EMAIL_FROM`: configure before enabling production account creation or recovery.

Optional integrations:

- `AI_PROVIDER`, `AI_API_BASE_URL`, `AI_MODEL`, `AI_API_KEY`: use only after provider security/privacy review. AI scoping is opt-in per brief and must remain editable.
- `OBJECT_STORAGE_*`: currently unused. Do not collect private deliverables until storage access controls, expiry, scanning, and deletion are implemented.
- The generic `PAYMENT_MODE` webhook is separate from the Paga flows and is not compatible with Paga callbacks.
- Paga Sandbox settings are documented in [the Paga Sandbox guide](./paga-sandbox.md). Paga requests are enabled only when `PAGA_ENABLE_SANDBOX=true`, Sandbox credentials and callbacks are configured, migrations are applied, and the account is entitled to the operations. Live operations are rejected in code.

Never put production secrets in `.env.example`, source control, client code, logs, or campaign content.

## Release procedure

1. Run `npm ci` after the lockfile is committed.
2. Set production environment variables in the hosting secret manager.
3. Run `npm run test`, `npm run lint`, and `npm run build` in CI.
4. Apply reviewed migrations with `npm run db:deploy` as a release step.
5. Deploy the build behind HTTPS and a trusted reverse proxy.
6. Check `GET /api/health` from the hosting platform; it returns `200` only when PostgreSQL responds to a simple query.
7. Verify registration and email delivery, sign-in and recovery, workspace role boundaries, and a campaign test flow in a non-production environment.
8. Keep Paga in Sandbox until account provisioning, funding, USD collection, compensation transfer, bank validation, payout callbacks, status reconciliation, and reversal reimbursement have each passed against the verified Sandbox account. Sandbox supports test funds only. Never send real money through this environment.

The app sets baseline browser security headers in `next.config.ts`, including HSTS in production, and uses a PostgreSQL fixed-window limiter for login, registration, and password-reset requests. A separate security review is still required for CSP, limiter thresholds and proxy-sanitized `x-forwarded-for` headers, broader abuse protection, session/cookie deployment settings, dependency advisories, and hosting/network configuration.

## Backup, monitoring, and recovery

- Configure provider-managed PostgreSQL backups and point-in-time recovery. Define retention and data residency with the database host.
- Perform a restore drill before launch and periodically after launch. Confirm restored application compatibility before cutting over.
- Monitor application errors, HTTP 5xx, latency, database availability/connection pool saturation, failed email delivery, and disk/storage use through the hosting provider or an approved monitoring service.
- Alert on open disputes, payment reconciliation exceptions, webhook exceptions, and repeated authentication failures. The database has audit records and a health endpoint, but no alerting integration is configured here.
- For a suspected credential leak, rotate affected secrets, revoke provider sessions/keys, preserve audit events, review access logs, and follow the organisation's incident process.
- For a database restore, pause writes, record the recovery point, restore into an isolated instance, validate counts and login, then switch traffic only after review.

## Payment integration status

The repository now contains Paga Sandbox account, USD-to-NGN funding, subsidiary transfer, bank validation, withdrawal, callback, and reconciliation code. This is an implementation record, not evidence that the production deployment has completed a successful provider transaction. Do not enable Sandbox actions until the migration is applied and Paga has confirmed the required product entitlements, callback configuration, and allowlisted deployment egress. Live operations remain disabled. See [Paga Sandbox setup and the end-to-end checklist](./paga-sandbox.md).

USD collection settles as NGN; EUR and GBP are not supported. The app does not provide escrow or conditional custody. Sandbox operations use test funds and must not be used for real transfers.

## Known release blockers

- Node.js build/test/lint and Prisma schema validation have not run on the source system.
- Paga Sandbox requests and callbacks have not been evidenced as end-to-end verified in this repository; Live operations are disabled.
- Manual campaign attribution is a reviewable record, not provider-verified conversion tracking.
- Private file storage, malware scanning, upload limits, and private delivery-file handling are not implemented.
- Rate limiting, automated integration/E2E tests, accessibility audit, monitoring/alerting, and production email have not been completed.
- Identity verification and legal/provider approval remain external dependencies. Do not represent a published profile or skills score as identity verification.
- Terms and privacy pages are drafts requiring qualified legal review and deployment-specific provider disclosures.
