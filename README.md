# Kintovo

Kintovo is a Nigeria-first talent and project-execution platform for structured work between African businesses, professionals, and creators.

It helps a buyer move from a business objective to a managed project by combining organisation workspaces, project planning, specialist and creator discovery, assessments, shortlists, proposals, versioned agreements, tasks, threaded communication, milestone reviews, campaigns, disputes, notifications, and operational administration.

The problem it addresses is fragmentation. Businesses often use separate tools for finding talent, assessing capability, negotiating terms, managing tasks, reviewing delivery, communicating with contributors, handling disputes, and tracking compensation. Kintovo brings those stages into one project and delivery workflow.

## Product overview

- Businesses can describe an objective or create a project brief directly.
- The scope planner identifies workstreams and required skills through deterministic rules. It can use Google's Gemini API with explicit user consent for an AI-assisted plan.
- Human reviewers can approve or revise project briefs.
- Businesses can discover professionals and creators using skills, language, industry, rate, level, assessment, and engagement filters.
- Users can create shortlists, negotiate proposals and counteroffers, and accept versioned agreements.
- Active projects contain teams, tasks, comments, private attachments, milestones, structured revision requests, partial settlement proposals, and completion records.
- Creators can join campaigns, submit content, receive fixed, hybrid, or commission-only terms, and appear in campaign reports.
- Campaign attribution supports configurable attribution windows and refund-aware conversion and bonus handling.
- Operations staff can manage account access, profile publication, assessments, complaints, disputes, appeals, reports, audit records, and provider operations.
- Identity evidence and trust evidence are restricted. Document access is limited to authorised administrators and recorded through audit activity.
- Private uploads are supported for deliverables, messages, task comments, dispute evidence, portfolio items, and trust evidence. Upload types are checked and downloads are authorised server-side.

## Technology

- Next.js App Router
- React and TypeScript
- React Server Components and client components
- Tailwind CSS
- Auth.js credentials and Google OAuth authentication
- PostgreSQL
- Prisma ORM and Prisma migrations
- Neon pooled runtime connections and direct migration connections
- Vercel application hosting
- Zod request validation
- bcrypt password hashing
- Nodemailer and SMTP email delivery
- Google Gemini-compatible AI planning API
- Docker and Docker Compose
- Paga Engine Sandbox foundations

## Gemini API

The scope planner uses Google's Gemini API as an optional, consent-based AI assistant.

The server reads `AI_API_KEY`, `AI_PROVIDER`, `AI_API_BASE_URL`, and `AI_MODEL`. Gemini is the default provider. The configured default model is `gemini-3.8-flash`.

The application sends the project brief and optional planning conversation to an OpenAI-compatible Gemini chat-completions endpoint only after the user opts in. The generated plan remains editable before submission.

Kintovo does not accept Gemini output as an automatic final decision. A rules-based planner remains available, and the brief review workflow gives staff an opportunity to correct the plan.

Do not send confidential project information through a free or externally hosted AI tier unless the relevant provider policy and data-handling requirements have been reviewed.

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

## Paga Engine integration

Paga is implemented behind a provider-independent payment interface. Paga is Sandbox-only in the current codebase and Live operations are intentionally rejected.

The integration uses Paga-specific authentication and request signing:

- Paga Collect operations use HTTP Basic authentication with the public and secret keys.
- Collect request hashes use SHA-512 over the parameter values in the operation's documented order, followed by the Paga hash key.
- Paga Business operations use Paga principal and credentials headers with an operation-specific SHA-512 hash.
- Paga callbacks are verified separately from the platform's generic payment webhook.
- Provider references are treated as stable identifiers for retries and reconciliation.

Implemented Paga foundations include:

- NGN subsidiary account creation and account retrieval
- Subsidiary account balance checks
- Subsidiary account top-ups and charges
- Paga-confirmed ledger and compensation transfer records
- USD bank collection payment requests
- USD collection status checks
- Conversion of confirmed USD settlement into NGN subsidiary-account funding
- Nigerian bank directory retrieval
- Nigerian bank destination validation
- Bank transfer requests and payout status checks
- Signed callback verification
- Paga reversal and reimbursement preparation
- Reserved, processing, confirmed, failed, and reconciliation states
- Repeated-reference protection for retries

The Paga Collect API is used for subsidiary accounts and USD collection. The Paga Business API is used for bank lookup, destination validation, bank payouts, and transfer status.

NGN subsidiary accounts are supported in the implemented flow. EUR and GBP are not implemented. USD collection is separate from a USD wallet: confirmed USD collection is expected to settle into the applicable NGN balance and must be reconciled before release.

Paga subsidiary accounts are not escrow or a conditional custody service in Kintovo. The system does not claim that Paga has approved Kintovo's third-party marketplace model or that customer funds are legally protected by Paga.

Before production use, Kintovo requires Paga account approval, account entitlements, public callback URLs, deployment egress allowlisting, Sandbox credentials, and a successful provider callback and reconciliation cycle. Written approval is also required for collecting buyer funds and paying independent professionals or creators. Live keys remain disabled.

No successful Paga Sandbox or Live transaction is claimed without an evidenced end-to-end callback and reconciliation cycle.

## Deployment

Vercel is the current application deployment and Neon provides the PostgreSQL database.

The runtime uses the Neon pooled `DATABASE_URL`. Prisma CLI operations use the direct, unpooled `DIRECT_URL`. Migrations must be reviewed and applied with `npm run db:deploy` before a release.

The Docker deployment includes a production Dockerfile and `docker-compose.yml`:

- The image uses Node.js 22.18
- The container runs Next.js on port 3000
- Committed Prisma migrations run before the application starts
- The private upload volume is separate from the application image
- An application health endpoint is used as a container health check
- Database pool limits can be adjusted with `DATABASE_POOL_MAX`

Litehost was offered as an infrastructure sponsor and was considered for the primary Node.js deployment. Litehost offered a Premium Node.js plan, but the sponsor coupon was not accepted for the selected Node.js product. Checkout returned “No products in basket qualify for this promotion,” and Litehost confirmed that the promotion applied only to an eligible product configuration for a limited period.

The coupon issue did not affect the application code or database. Vercel and Neon were used for the current deployment. Litehost remains a possible future Node.js host because the application requires a Node.js server and PostgreSQL rather than a PHP or WordPress runtime.

## Current implementation boundary

Implemented in code: responsive public pages; business, specialist, and creator registration; sign-in, email verification, and password reset; organisations, invitations, and scoped membership; separate professional and creator profiles with a per-item portfolio (files, links, contribution, visibility); project briefs, editable deterministic/opt-in AI scoping, human brief review; talent search with language, industry, rate, level, assessment, and engagement filters, sorting, and side-by-side comparison; shortlists, proposals, counteroffers, and versioned agreements; tasks with comments, threaded project messages, private file attachments, milestones with structured revision requests and buyer-proposed partial settlements, change requests, disputes with evidence, assigned reviewers, party/internal notes and confirmed outcomes, and completion; identity verification with Admin-only document access; appeals and correction requests for trust and assessment decisions; creator campaigns with full briefs, fixed/hybrid/commission-only arrangements, attribution windows, refund treatment, signed conversion webhooks (test events), bonus reversal on refunds, and a campaign report; a provider-independent payment adapter interface (mock and Paga Sandbox status); Paga Sandbox NGN subsidiary accounts, USD-to-NGN collection, Paga-confirmed transfers, and Finance-reviewed withdrawals; notification preferences, email delivery for opted-in categories, and task-deadline reminders via a scheduled job; operations queues, audit-log viewer, webhook/provider monitor, reports, and admin controls. Sandbox operations use test funds; Live is disabled.

Still incomplete or unverified: malware scanning of uploads and an S3-compatible storage adapter (local disk only); live (non-test) campaign attribution integrations; full browser end-to-end and accessibility testing; definitive payout failure/recovery without a Paga-confirmed reversal; FX difference handling; EUR and GBP payments; production email, backups, monitoring, and legal/provider approvals. No Paga Sandbox transaction has been confirmed end to end in this repository. See [the 18 November 2026 gap audit](docs/gap-audit-2026-11-18.md) for the full list.

## Verification

The latest verification pass reports:

- 37 automated tests passing
- Five tests running against a real database
- TypeScript type checking passing
- The Next.js production build passing
- A role-based HTTP smoke test passing for all seven roles
- Cross-role page access restrictions passing
- Twenty-six new write features verified through a running server

The HTTP smoke test covered authentication and role-specific page access, including blocked cross-role routes. The temporary server write check was used during verification and is not retained as repository test infrastructure.

The verification process also found and fixed a local single-connection database issue. The database pool now supports an optional `DATABASE_POOL_MAX` setting.

Private production object storage, malware scanning, retention policies, full browser end-to-end testing, accessibility testing, Paga live approval, Paga end-to-end transaction evidence, and provider/legal operations remain release gates.

## Roles and administration

Kintovo uses two separate permission layers:

- `platformRole` controls staff capabilities across the platform: `USER`, `OPERATIONS`, `FINANCE`, and `ADMIN`.
- `OrganisationMembership.role` controls access inside one business workspace: `OWNER`, `ADMIN`, `PROJECT_MANAGER`, and `MEMBER`.

Organisation roles never grant platform administration. Platform roles must be assigned through an authorised administrative process, protected by server-side checks, and recorded in the audit log. The Admin console is available only when `user.platformRole === "ADMIN"`; it provides operational links, review queues, access-governance counts, recent accounts, and audit activity. It intentionally does not expose self-service promotion to Admin.

Paga is integrated in Sandbox-only paths and Live operations are rejected. Sandbox test funds do not move real money; Paga subsidiary accounts are not represented as escrow. EUR and GBP are unavailable, and USD collection settles in NGN. The legal pages are drafts and must be reviewed before launch. No customer, revenue, verified-profile, or pilot traction is claimed.

## Architecture and decisions

See [the technical discovery report](docs/discovery-report.md), [deployment runbook](docs/deployment-runbook.md), and [Paga Sandbox guide](docs/paga-sandbox.md). The application uses Next.js App Router, PostgreSQL with Prisma, Auth.js credentials sessions, and server-side domain services. Secrets and persistence stay server-side. External provider approval, Sandbox callback verification, operational reconciliation, and release readiness remain deployment gates.
