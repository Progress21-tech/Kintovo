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

For local account verification without SMTP, the one-time link is printed in the development server output. Configure SMTP before deploying; production account creation fails closed when email delivery is not configured. Password recovery uses the same mail adapter.

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

Implemented so far: responsive public positioning pages; business, specialist, and creator registration; password sign-in; one-time email verification and password reset; organisation creation, invitations, and role-scoped membership; separate specialist and creator profiles; persistent project briefs; deterministic workstream suggestions with optional, explicit-consent AI assistance; editable scope plans and human brief review; verified-and-published talent discovery with fit explanations, filters, shortlists, and review records; proposal and counteroffer records; dual-party versioned agreement acceptance; active project tasks, messages, milestone submissions and review, revision requests, change requests, dispute records, and completion checks; and audit events for key workflow changes. Delivery evidence currently supports an optional external link and submission note.

Still required for the complete product in `implementation.md`: Node.js installation to generate the Prisma client and validate/build the app; a database migration and application runtime review; secure object storage, private uploads, and scanning; full identity and practical skills-assessment workflows; complete operations tooling for disputes, campaigns, payments, webhooks, notifications, and reports; creator campaign delivery and attribution; comprehensive integration/end-to-end/accessibility coverage; production email, rate limiting, deployment, backups, and monitoring; and legal review. Project payments are not implemented by these delivery records; they do not hold, recover, or release funds. Database client generation, migrations, lint, application build, and runtime behavior have not been verified because Node.js is unavailable on the current system.

Paga and Busha remain evaluation candidates. Payment records are labelled simulated; this application does not hold funds, promise escrow, or perform live payment operations. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md). The application uses Next.js App Router with React server-rendered pages and server actions, PostgreSQL with Prisma, Auth.js credentials sessions, domain helpers for scope suggestions, and an email adapter. Secrets and persistence stay server-side. Payment and AI integrations are deliberately replaceable. The initial product path prioritises the demand-side brief and human review workflow before marketplace scale.
