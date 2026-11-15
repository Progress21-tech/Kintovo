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
- `PAYMENT_MODE` must remain `simulated`. `PAYMENT_PROVIDER_NAME` and `PAYMENT_WEBHOOK_SECRET` do not enable a provider adapter. The generic webhook route is disabled in simulated mode and is not compatible with Paga callbacks.
- Paga settings are documented in [the Paga integration audit](./paga-integration-audit.md). Keep `PAGA_ENABLE_SANDBOX=false`; the SHA-512/configuration boundary is not a payment adapter, and no Paga API operation is enabled. Live operations are explicitly disabled in code.

Never put production secrets in `.env.example`, source control, client code, logs, or campaign content.

## Release procedure

1. Run `npm ci` after the lockfile is committed.
2. Set production environment variables in the hosting secret manager.
3. Run `npm run test`, `npm run lint`, and `npm run build` in CI.
4. Apply reviewed migrations with `npm run db:deploy` as a release step.
5. Deploy the build behind HTTPS and a trusted reverse proxy.
6. Check `GET /api/health` from the hosting platform; it returns `200` only when PostgreSQL responds to a simple query.
7. Verify registration and email delivery, sign-in and recovery, workspace role boundaries, a campaign test flow, and a simulated ledger record in a non-production environment.
8. Keep the payment mode simulated and never enter real bank or crypto recipient credentials in this application.

The app sets baseline browser security headers in `next.config.ts`, including HSTS in production, and uses a PostgreSQL fixed-window limiter for login, registration, and password-reset requests. A separate security review is still required for CSP, limiter thresholds and proxy-sanitized `x-forwarded-for` headers, broader abuse protection, session/cookie deployment settings, dependency advisories, and hosting/network configuration.

## Backup, monitoring, and recovery

- Configure provider-managed PostgreSQL backups and point-in-time recovery. Define retention and data residency with the database host.
- Perform a restore drill before launch and periodically after launch. Confirm restored application compatibility before cutting over.
- Monitor application errors, HTTP 5xx, latency, database availability/connection pool saturation, failed email delivery, and disk/storage use through the hosting provider or an approved monitoring service.
- Alert on open disputes, payment reconciliation exceptions, webhook exceptions, and repeated authentication failures. The database has audit records and a health endpoint, but no alerting integration is configured here.
- For a suspected credential leak, rotate affected secrets, revoke provider sessions/keys, preserve audit events, review access logs, and follow the organisation's incident process.
- For a database restore, pause writes, record the recovery point, restore into an isolated instance, validate counts and login, then switch traffic only after review.

## Payment provider evaluation (reviewed 2026-11-09)

Paga is the requested provider and its documented integration boundary has been reviewed; no Paga money movement endpoint has been integrated or enabled. Obtain written product/commercial approval and complete legal, regulatory, operational, reconciliation, and support reviews before enabling any flow.

- **Paga Engine:** its official documentation describes Nigerian bank/Paga-wallet payouts from a Paga business balance, account validation, status callbacks, and sandbox/live environments with separate credentials. It uses Paga-specific SHA-512 request/callback hashing and IP allowlisting. Kintovo needs written marketplace approval, Sandbox approval/credentials, a fixed allowlisted egress IP, and a reviewed Paga-specific callback. Current code includes ordered SHA-512/hash verification and environment guards; it does not initiate payments or payouts. See [Money Transfer](https://developer-docs.paga.com/docs/money-transfer-payout), [Hash handling](https://developer-docs.paga.com/docs/handling-hash), and [Get started](https://developer-docs.paga.com/docs/get-started).
- **Busha:** its official docs describe quote/recipient/transfer steps for payouts, including crypto-to-fiat flows, bearer-token authentication, and webhook/polling status checks. Review settlement assets, fees, destination verification, customer/provider KYC, supported countries, reversals, and custody/crypto implications before deciding whether it fits this product. See [Process payouts](https://docs.busha.co/guide/how-to-guides/process-payouts), [Recipients](https://docs.busha.co/guide/reference/recipients), and [API reference](https://docs.busha.co/reference).

## Known release blockers

- Node.js build/test/lint and Prisma schema validation have not run on the source system.
- No Paga payment adapter or Paga webhook route exists; Sandbox endpoints have not been exercised.
- Manual campaign attribution is a reviewable record, not provider-verified conversion tracking.
- Private file storage, malware scanning, upload limits, and private delivery-file handling are not implemented.
- Rate limiting, automated integration/E2E tests, accessibility audit, monitoring/alerting, and production email have not been completed.
- Identity verification and legal review remain external dependencies. Do not represent a published profile or skills score as identity verification.
- Terms and privacy pages are drafts requiring qualified legal review.
