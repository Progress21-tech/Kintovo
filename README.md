# Kintovo

Kintovo is a Nigeria-first, curated execution network. This repository contains the product foundation and core buyer-to-delivery workflows: authentication, organisation-scoped workspaces, specialist and creator profiles, project discovery, editable scope suggestions, talent matching, shortlists, proposal negotiation, versioned agreements, and project delivery records.

## Requirements

- Node.js 22.18+ (required by the Prisma 7 setup used here)
- PostgreSQL 15+
- npm

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_URL`.
3. Generate the database client: `npm run db:generate`
4. Create the initial database migration: `npx prisma migrate dev --name init`
5. Start the app: `npm run dev`
6. Visit `http://localhost:3000`.

Email verification is optional and can be enabled with `REQUIRE_EMAIL_VERIFICATION="true"`. For local development without SMTP, the one-time link is printed in the development server output when verification is enabled. Password recovery uses the same mail adapter.

To load fictional demo data for every role, run `$env:ENABLE_DEMO_SEED="1"; npm run db:seed` in PowerShell (or `ENABLE_DEMO_SEED=1 npm run db:seed`) after migrations. It creates admin, operations, finance, business owner, project manager, two specialists, a specialist awaiting review, and a creator, all `@example.test` with the password `Kintovo-demo-only!2026`, plus projects at each stage, a negotiation, a dispute, a campaign, and simulated payments. The seed refuses to run with `NODE_ENV=production`; every record is labelled fictional. Never use these credentials outside a local database.

No local PostgreSQL? `npx prisma dev -n kintovo --detach` starts Prisma's local Postgres and prints a `postgres://…` TCP URL to use for `DATABASE_URL` and `DIRECT_URL` (append `&connection_limit=1` to `DATABASE_URL`). With Docker: `AUTH_SECRET=… docker compose up --build`.

## Available commands

- `npm run dev` — local development server
- `npm run build` — generate Prisma client and build the application
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run test` — unit tests plus database integration tests (organisation isolation, notification preferences, private storage, signed attribution and payment webhooks). Integration tests skip when `DATABASE_URL` is unset.
- `node scripts/smoke-e2e.mjs` — HTTP journey smoke test against a running, seeded server (`BASE_URL` defaults to `http://localhost:3000`).
- `npm run db:migrate` — create/apply a development migration
- `npm run db:deploy` — apply committed migrations in production
- `npm run db:generate` — regenerate the typed database client

## Current implementation boundary

Implemented in code: responsive public pages; business, specialist, and creator registration; sign-in, email verification, and password reset; organisations, invitations, and scoped membership; separate professional and creator profiles with a per-item portfolio (files, links, contribution, visibility); project briefs, editable deterministic/opt-in AI scoping, human brief review; talent search with language, industry, rate, level, assessment, and engagement filters, sorting, and side-by-side comparison; shortlists, proposals, counteroffers, and versioned agreements; tasks with comments, threaded project messages, private file attachments, milestones with structured revision requests and buyer-proposed partial settlements, change requests, disputes with evidence, assigned reviewers, party/internal notes and confirmed outcomes, and completion; identity verification with Admin-only document access; appeals and correction requests for trust and assessment decisions; creator campaigns with full briefs, fixed/hybrid/commission-only arrangements, attribution windows, refund treatment, signed conversion webhooks (test events), bonus reversal on refunds, and a campaign report; a provider-independent payment adapter interface (mock, Paga Sandbox status, Busha evaluation-only); Paga Sandbox NGN subsidiary accounts, USD-to-NGN collection, Paga-confirmed transfers, and Finance-reviewed withdrawals; notification preferences, email delivery for opted-in categories, and task-deadline reminders via a scheduled job; operations queues, audit-log viewer, webhook/provider monitor, reports, and admin controls. Sandbox operations use test funds; Live is disabled.

Still incomplete or unverified: malware scanning of uploads and an S3-compatible storage adapter (local disk only); live (non-test) campaign attribution integrations; full browser end-to-end and accessibility testing; definitive payout failure/recovery without a Paga-confirmed reversal; FX difference handling; EUR and GBP payments; Busha integration (evaluation adapter refuses all operations); production email, backups, monitoring, and legal/provider approvals. No Paga Sandbox transaction has been confirmed end to end in this repository. See [the 18 November 2026 gap audit](docs/gap-audit-2026-11-18.md) for the full list.

## Roles and administration

Kintovo uses two separate permission layers:

- `platformRole` controls staff capabilities across the platform: `USER`, `OPERATIONS`, `FINANCE`, and `ADMIN`.
- `OrganisationMembership.role` controls access inside one business workspace: `OWNER`, `ADMIN`, `PROJECT_MANAGER`, and `MEMBER`.

Organisation roles never grant platform administration. Platform roles must be assigned through an authorised administrative process, protected by server-side checks, and recorded in the audit log. The Admin console is available only when `user.platformRole === "ADMIN"`; it provides operational links, review queues, access-governance counts, recent accounts, and audit activity. It intentionally does not expose self-service promotion to Admin.

Paga is integrated in Sandbox-only paths and Live operations are rejected. Sandbox test funds do not move real money; Paga subsidiary accounts are not represented as escrow. EUR and GBP are unavailable, and USD collection settles in NGN. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md), [deployment runbook](docs/deployment-runbook.md), and [Paga Sandbox guide](docs/paga-sandbox.md). The application uses Next.js App Router, PostgreSQL with Prisma, Auth.js credentials sessions, and server-side domain services. Secrets and persistence stay server-side. External provider approval, Sandbox callback verification, operational reconciliation, and release readiness remain deployment gates.
