# Kintovo technical discovery

## 1. Product understanding

Kintovo is a curated, demand-led network that connects business goals to African expertise and coordinated delivery. Its defining path is an editable project plan, followed by either a direct specialist hire or a coordinated team, then negotiation, an accepted agreement, milestone work, review, and settlement records. Team assembly is the primary proposition; individual hiring is the secondary path. Nigeria is the initial delivery market. The pitch deck describes a pre-launch concept and labels the market, pricing, traction, and provider assumptions as unvalidated or pending.

## 2. Brand and visual interpretation

The design system sets a warm paper background (`#F7F5F0`), white surfaces, ink text (`#202522`), muted text (`#68716C`), quiet lines (`#E5E0D7`), coral action (`#E45A3D`), soft coral (`#FBEAE4`), teal positive (`#2E786D`), blue information (`#496F8A`), and amber attention (`#B77A32`). Inter Display and Inter, a 4 px spacing grid, compact uppercase labels, visible focus, and clear status/action language define the interface. The product should feel editorial, calm, and operational rather than decorative.

The first pitch slide includes a small coral line-and-dot symbol before the headline. The mark is represented in the UI as a compact coral, connected-stroke SVG with a dot, alongside an uppercase wordmark. This is a vector interpretation of the small slide mark; the supplied PDFs do not include standalone brand asset files or written logo construction rules. Clear space and minimum size are therefore implemented conservatively and remain assumptions for brand review.

## 3. Product module map

1. Public website, legal drafts, contact, and account access.
2. Identity, authentication, onboarding, organisations, roles, and invitations.
3. Business discovery, saved drafts, AI-assisted scope suggestions, and brief review.
4. Specialist and creator profiles, portfolios, skills, market experience, availability, and rates.
5. Trust evidence, verification review, assessments, appeals, and delivery record.
6. Talent search, filters, shortlists, and explainable recommendations.
7. Direct hiring and coordinated team formation.
8. Proposals, counteroffers, immutable agreement versions, and acceptance records.
9. Project workspace, tasks, participant messages, and private files.
10. Milestones, submissions, review, revision, change requests, cancellation, and disputes.
11. Creator campaigns, fixed/hybrid/commission terms, content approval, tracking, attribution, and reporting.
12. Compensation ledger, payment obligations, provider adapters, webhook verification, and reconciliation.
13. Business/talent/admin reporting, notifications, audit history, and operations console.

## 4. Roles and permission boundaries

- **Platform roles:** visitor, authenticated user, operations reviewer, finance operator, and platform administrator. Administrative capabilities must be explicit and server-authorised; identity evidence is limited to specially authorised reviewers.
- **Organisation roles:** owner, administrator, project manager, and authorised member. Membership grants only that organisation's permitted records. Project creation does not grant financial authority. Financial actions require an owner/admin or separately scoped permission.
- **Talent contexts:** specialist and creator profiles may belong to one account. Creators are not automatically affiliates; UGC production must be possible without publishing to a creator's audience.
- **Project roles:** buyer-side participants and invited professionals see only their engagements; only the appropriate buyer role can approve commercial commitments and payments.

## 5. Proposed technical architecture

Use a TypeScript modular monolith with Next.js App Router, React server-rendered pages, server actions/API routes, PostgreSQL, Prisma, and Auth.js. Organise domains under `src/server` and keep validation, permission checks, domain transitions, and integrations separate from UI. Use a private object store abstraction for uploads, an email adapter, a background job boundary, and provider-independent AI/payment interfaces. Start with deterministic explainable matching and editable scope suggestions. Do not send sensitive evidence to an AI service.

The foundation uses PostgreSQL and Auth.js credentials with one user identity supporting multiple role contexts. PostgreSQL is a required runtime dependency; without `DATABASE_URL`, persistence features must fail clearly rather than silently act as if data were saved. This workspace has no Node.js/npm executable available, so dependency installation, migrations, and production build could not be run here.

## 6. Database design approach

Use normalised relational records and enums, not a generic JSON document per feature. Core groups are: User/Account/Session/VerificationToken; Organisation/OrganisationMembership/Invitation; ProfessionalProfile/CreatorProfile/Skill/PortfolioItem/Availability/VerificationRecord/Assessment; ProjectBrief/Workstream/Shortlist; Engagement/EngagementParticipant/Proposal/Agreement/AgreementVersion; Task/Message/FileRecord/Milestone/Submission/Review/ChangeRequest/Dispute; Campaign/CampaignCreator/ContentSubmission/TrackingLink/ReferralCode/AttributionEvent; CompensationObligation/LedgerEntry/ProviderEvent/Reconciliation; Notification/AuditLog/PlatformSetting. Keep identity verification evidence behind private object storage and scoped access. Preserve agreement and payment history as append-only records.

## 7. Workflow map

**Business discovery:** account → organisation → choose defined need or goal planning → save/edit structured brief → editable suggested workstreams → request individual hiring or team assembly → operations review.

**Hiring and delivery:** shortlist → invite → proposal/counteroffer → append agreement version → formal acceptance → workspace → task/milestone submission → time-boxed review → approve, revise, or dispute → completion and ledger records.

**Creator campaign:** campaign brief → creator invitations → mutually accepted deliverables/rights/compensation/attribution → content submission and approval → publication or UGC handoff → supported event attribution and refund handling → report and compensation record.

**Payment:** obligation → simulated or specifically approved sandbox event → signature-verified webhook/event → append ledger entry → reconcile. Live holding, conditional release, custody, and escrow remain disabled until provider, legal, and business approvals exist.

**Operations:** review application/evidence → record decision and audit event → triage briefs, active work, complaints, disputes, campaigns, and reconciliation with least privilege.

## 8. Integrations and approval dependencies

- **Database:** PostgreSQL connection and migration/deployment configuration required.
- **Authentication/email:** Auth.js can run with credentials. Email verification, recovery, and email notifications require an approved mail provider and delivery configuration.
- **AI:** provider-neutral adapter; API key/model configuration and privacy review required. Deterministic editable fallback must be available.
- **Files:** private object storage, size/type scanning, retention, signed access, and secret configuration required before portfolio/document uploads.
- **Payments:** mock adapter is explicitly simulated. Paga and Busha are evaluation candidates only; their APIs do not establish approval for third-party holding or conditional release. Live operations remain disabled pending commercial, legal, and provider approval.
- **Operations:** monitoring, backups, rate limiting, background jobs, and production secrets require deployment setup.

## 9. Development phases

1. Discovery and architecture (this report).
2. Project foundation, brand assets, design tokens, and shared layout.
3. Authentication and buyer/talent/creator onboarding.
4. Business discovery, saved briefs, scope suggestions, and admin review.
5. Talent profiles, trust evidence, search, and explainable matching.
6. Team assembly, individual engagement, proposals, and versioned agreements.
7. Project workspace, milestones, reviews, revisions, and disputes.
8. Creator campaigns and attribution.
9. Compensation ledger, mock adapter, webhook verification, and reconciliation.
10. Notifications, reporting, and operations console.
11. Security, accessibility, responsive, regression, and end-to-end hardening.
12. Deployment, migrations, backups, monitoring, and handover.

## 10. Contradictions, gaps, and assumptions

- The detailed engineering brief requests a complete platform, while the investor deck describes a pre-launch concierge pilot and says to prove demand before scaling. The implementation sequence should therefore ship a working pilot workflow first and must not advertise unbuilt modules as live.
- “Payment protection” is a target process, not evidence that Kintovo or either named candidate can hold funds. The platform must distinguish simulated records from provider-confirmed transactions and must not call the mock flow escrow.
- No exact legal terms, privacy text, provider approval, commercial pricing, market sizing, or customer/talent evidence is supplied. Legal pages must be drafts; pricing and network claims must not be invented.
- The team slide marks Shalom Julius's remit as proposed and requiring confirmation before external circulation. Do not publish the proposed remit as confirmed.
- The PDFs provide only a low-scale mark reference, not vector source, clear-space, or minimum-size rules. The SVG is a documented interpretation until the brand owner reviews it.
- The organisation financial permission matrix, review time limits, dispute service levels, tax treatment, data retention schedule, and target email/storage providers remain implementation decisions or external dependencies.

## Initial implementation boundary

The repository was empty apart from this brief. The code foundation begins with the public positioning, role-aware account creation/sign-in, organisation access checks, and a persistent business brief workflow. Other product areas are represented in the domain model and roadmap but are not claimed as completed until their workflows and permissions are implemented.
