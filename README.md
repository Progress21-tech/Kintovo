# Kintovo

Kintovo is a Nigeria-first, curated execution network. This repository begins the product foundation with account access, organisation-scoped business workspaces, persistent project briefs, editable rule-based workstream suggestions, and a human-review submission state.

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

Implemented in this foundation: responsive public positioning pages; business, specialist, and creator account registration; password sign-in; one-time email verification and password reset; business organisation creation; organisation-role checks; persistent project-brief drafts; deterministic, editable workstream suggestions; brief submission for human review; basic professional/creator profile editing; private-by-default profile records; verified-and-published talent discovery filtering; agreement/payment empty states; and audit events for key account and brief changes.

Still required for the complete product in `implementation.md`: invitation and organisation-member management; actual email delivery configuration; rate limiting and production security review; object storage and upload scanning; independent identity/skills/portfolio review tools; searchable talent and shortlists; proposal/counteroffer and agreement acceptance interfaces; project tasks, messages, submissions, reviews, revisions, and disputes; creator campaign workflow and attribution; project-linked compensation ledger operations, signed provider webhooks, and reconciliation; notifications; analytics; a permissioned operations console; comprehensive integration/end-to-end/accessibility tests; deployment/backup/monitoring setup; and legal review. The current automated tests cover only scope suggestion and role-policy helpers.

Paga and Busha remain evaluation candidates. Payment records are labelled simulated; this application does not hold funds, promise escrow, or perform live payment operations. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md). The application uses Next.js App Router with React server-rendered pages and server actions, PostgreSQL with Prisma, Auth.js credentials sessions, domain helpers for scope suggestions, and an email adapter. Secrets and persistence stay server-side. Payment and AI integrations are deliberately replaceable. The initial product path prioritises the demand-side brief and human review workflow before marketplace scale.
