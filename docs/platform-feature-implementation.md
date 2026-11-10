# Platform operations and feature delivery record

Date: 10 November 2026

This record tracks delivery of the requested admin, trust, workspace settings, complaints, reputation, payout review, and policy work. It distinguishes code-path review from runtime testing.

## Stage 1 — Review gates and validation baseline

### Existing implementation confirmed by source review

- Business project goals are saved as briefs and submitted to human review. Only an authorised Admin or Operations reviewer can move a submitted brief into `MATCHING`; returned briefs go back to `DRAFT`.
- Specialist and Creator profiles remain unpublished until profile submission, approved portfolio/authorship evidence, and an authorised publication action. Talent discovery filters for published profiles with approved evidence.
- Skills assessments have an operations assignment and scoring workflow.
- Campaign links track clicks; manual conversion claims are reviewed before bonus obligations are created. Those obligations are simulated.

### Validation limitation

These are source-level checks only. No configured PostgreSQL database, installed dependencies, or working Node.js executable is available in this checkout, so the signup-to-approval-to-discovery journey could not be exercised in a running app in this stage. The repository specifies Node.js 22.18+, while the machine's npm wrapper has no accompanying `node.exe`.

### Manual acceptance path for a configured test environment

1. Register a Business account, create a project goal, and submit it for review.
2. Confirm it is not yet in talent matching; approve it from Operations → Brief review; confirm it moves to matching and is visible to its business members.
3. Register Specialist and Creator accounts, complete profiles, and submit evidence.
4. Confirm neither profile is discoverable before evidence approval and publication; approve the evidence and publish each profile; confirm Specialists appear in business talent search and Creators appear as eligible campaign invitees.
5. Confirm a standard user cannot call review or publication actions successfully.

## Stage 2 — Admin monitoring and account access controls

### Implemented

- Replaced the generic verified-account metric with separate registered-account, 30-day active-account, business workspace, approved business-goal, completed Specialist/Creator profile, and published talent counts.
- Added account search and status filters at `/workspace/admin/users`, with profile state and recent activity context.
- Added audited temporary suspension, restoration, and permanent account ban actions. A ban blocks credentials and Google sign-in and is irreversible from the admin screen. Administrators cannot change their own access.
- Added individual received-compensation and initiated-obligation totals by currency, plus platform settlement totals by currency and source. Simulated settlements are labelled as simulated.
- Added a five-minute activity timestamp throttle to avoid writing an activity record on every protected page load.
- Added a PostgreSQL migration for ban/activity fields and an index supporting active-account queries.

### Design boundary

Permanent bans retain the account and audit record and block that account from signing in. This stage does not delete account data or retain IP addresses/IP hashes for a blacklist. IP addresses can be shared or change over time, and the legal/privacy basis and retention policy for an IP blocklist have not been established. The existing Terms and Privacy pages remain draft notices requiring counsel review.

### Validation and delivery

- `git diff --check` and source-level review are used for this stage.
- Build, lint, database migration, unit, and browser-flow execution remain unavailable because the checkout has no working Node.js executable, dependencies, or configured database.
- Code and migration files for this stage will be committed and pushed to `main` before Stage 3 begins.
