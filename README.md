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

Implemented in code: responsive public pages; business, specialist, and creator registration; sign-in, email verification, and password reset; organisations, invitations, and scoped membership; separate professional and creator profiles; project briefs, editable deterministic/opt-in AI scoping, human brief review, talent discovery, shortlists, proposals, counteroffers, and versioned agreements; tasks, messages, milestones, revisions, changes, disputes, and completion; creator campaigns, content review, referral clicks, manually reviewed conversions, and bonuses; Paga Sandbox NGN subsidiary accounts, USD-to-NGN collection, signed account callbacks, Paga-confirmed business-to-talent transfers, validated bank destinations, and Finance-reviewed NGN withdrawal attempts; operations queues, audit records, notifications, reports, and admin controls. Sandbox operations use test funds; Live is disabled.

Still incomplete or unverified: private file uploads and malware scanning; identity verification; provider-verified campaign attribution; full campaign, business, and talent reporting; notification preferences and complete email coverage; definitive payout failure/recovery for cases without a Paga-confirmed reversal; FX difference/manual finance resolution; EUR and GBP payments; automated integration and browser end-to-end coverage; current build/migration execution; production email, backups, monitoring, security/accessibility review, and legal/provider approvals. No Paga Sandbox transaction has been confirmed by an end-to-end result in this repository. Do not use Sandbox as a real payment service.

## Roles and administration

Kintovo uses two separate permission layers:

- `platformRole` controls staff capabilities across the platform: `USER`, `OPERATIONS`, `FINANCE`, and `ADMIN`.
- `OrganisationMembership.role` controls access inside one business workspace: `OWNER`, `ADMIN`, `PROJECT_MANAGER`, and `MEMBER`.

Organisation roles never grant platform administration. Platform roles must be assigned through an authorised administrative process, protected by server-side checks, and recorded in the audit log. The Admin console is available only when `user.platformRole === "ADMIN"`; it provides operational links, review queues, access-governance counts, recent accounts, and audit activity. It intentionally does not expose self-service promotion to Admin.

Paga is integrated in Sandbox-only paths and Live operations are rejected. Sandbox test funds do not move real money; Paga subsidiary accounts are not represented as escrow. EUR and GBP are unavailable, and USD collection settles in NGN. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md), [deployment runbook](docs/deployment-runbook.md), and [Paga Sandbox guide](docs/paga-sandbox.md). The application uses Next.js App Router, PostgreSQL with Prisma, Auth.js credentials sessions, and server-side domain services. Secrets and persistence stay server-side. External provider approval, Sandbox callback verification, operational reconciliation, and release readiness remain deployment gates.
