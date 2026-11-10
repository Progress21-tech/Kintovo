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

After signup, users must verify their email before signing in. For local development without SMTP, the one-time link is printed in the development server output. Configure Resend SMTP and a verified sending domain before deploying. Password recovery uses the same mail adapter.

To add the fictional local demo account, run `$env:ENABLE_DEMO_SEED="1"; npm run db:seed` in PowerShell after migrations. Login is `buyer@example.test` with `Kintovo-demo-only!2026`. The seed refuses to run with `NODE_ENV=production`; the included profile is explicitly unverified and unpublished. Do not use the demo password outside a local development database.

## Available commands

- `npm run dev` — local development server
- `npm run build` — generate Prisma client and build the application
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run test` — focused unit tests for scope suggestions and role policy
- `npm run db:migrate` — create/apply a development migration
- `npm run db:deploy` — apply committed migrations in production
- `npm run db:generate` — regenerate the typed database client

## Current implementation boundary

Implemented in code: responsive public positioning pages; business, specialist, and creator registration; password sign-in; one-time email verification and password reset; organisation creation, invitations, and role-scoped membership; separate specialist and creator profiles; persistent project briefs; deterministic workstream suggestions with optional, explicit-consent AI assistance; editable scope plans and human brief review; published talent discovery requiring human-reviewed portfolio/authorship evidence, with fit explanations, filters, shortlists, and practical-assessment records; proposal and counteroffer records; dual-party versioned agreement acceptance; active project tasks, messages, milestone submissions and review, revision requests, change requests, dispute records, and completion checks; creator campaign invitations/contracts, content review/publication, referral click tracking, manual conversion claims, bonus calculation, and reports; milestone/campaign-derived payment obligations, simulated ledger actions and reconciliation, generic disabled webhook boundary; operations queues, dispute review, audit overview, notifications, user reports, and admin feature switches. Portfolio review and profile publication do not assert identity verification.

Not yet verified or production-ready: Node.js installation to generate the Prisma client and validate/build the app; Prisma schema validation and an initial migration; secure object storage, private uploads, and scanning; provider-specific payment adapters, callback verification, fee persistence, and bank payouts; automated database-backed integration and end-to-end tests; production review of rate limits, proxy headers, security, and accessibility; production email, deployment, backups, monitoring, and legal review. Project payment actions are local simulated ledger records and do not hold, recover, or release funds. Manual campaign attribution is not provider-verified. Database client generation, migrations, tests, lint, application build, and runtime behavior have not been verified because Node.js is unavailable on the current system.

Paga and Busha remain evaluation candidates. Payment records are labelled simulated; this application does not hold funds, promise escrow, or perform live payment operations. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md) and [deployment runbook](docs/deployment-runbook.md). The application uses Next.js App Router with React server-rendered pages and server actions, PostgreSQL with Prisma, Auth.js credentials sessions, domain helpers for scope suggestions/campaign bonuses, and an email adapter. Secrets and persistence stay server-side. Payment and AI integrations are replaceable. The runbook documents the missing migration, deployment steps, operational prerequisites, and current payment-provider evaluation.
