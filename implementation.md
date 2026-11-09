# KINTOVO
## MASTER PRODUCT DEVELOPMENT & ENGINEERING BRIEF
### Complete Full-Stack Platform Development From Scratch

**Product:** Kintovo  
**Product category:** Curated talent network and project-execution platform  
**Initial delivery market:** Nigeria  
**Buyer geography:** Global and African businesses  
**Primary users:** Businesses, independent specialists, digital professionals, creators and platform operations administrators  
**Development objective:** Build a complete, functional, secure, scalable and deployment-ready web platform.

---

# 1. YOUR ROLE AND MISSION

Act as a complete senior product engineering team consisting of:

- A senior product architect.
- A senior full-stack software engineer.
- A frontend engineer.
- A backend engineer.
- A database architect.
- A UI/UX designer.
- A product designer.
- An AI integration engineer.
- A payment systems engineer.
- A security engineer.
- A quality assurance and automation engineer.
- A DevOps and deployment engineer.

You are responsible for taking Kintovo from its current business concept to a fully functioning technology product.

You are not being asked to create a landing page, a dashboard mockup, a design prototype, a static frontend or a demonstration application.

You are building the actual product.

The final application must have a real frontend, backend, persistent database, authentication, permissions, functional user journeys, business logic, working workflows, administrative controls, integrations and automated tests.

Every important interaction must work.

A button must perform its advertised action. A form must validate and submit data. A project must persist in the database. A proposal must have a real status. An agreement must have a version history. A submitted milestone must be visible to the appropriate buyer. A payment status must be supported by a genuine provider event or explicitly identified as simulated.

Do not create decorative functionality that looks operational but does nothing.

Do not stop after completing the interface.

Do not treat the first successful rendering of the dashboard as completion.

Your responsibility is the complete implementation of the product scope specified in this document.

# 2. PROJECT INPUTS AND SOURCE DOCUMENTS

Two source documents will be provided alongside this prompt.

### Document A: Kintovo Investor Pitch Deck

Study the entire presentation, not just the first slide.

Use it to understand:

- Kintovo's business concept.
- The problem being addressed.
- The proposed solution.
- The primary and secondary engagement models.
- Business onboarding and discovery.
- Talent intelligence and matching.
- Engagement workflows.
- Payment protection principles.
- Creator partnerships.
- Market positioning.
- Business model.
- Go-to-market strategy.
- Product roadmap.
- Team and organisational context.
- Brand positioning and visual identity.

The pitch deck is the reference for the business narrative and positioning.

### Document B: Kintovo Design System V1

Study the entire design system before implementing the interface.

It defines the intended:

- Brand expression.
- Colour palette.
- Typography.
- Spacing system.
- Buttons.
- Form elements.
- Status indicators.
- Talent cards.
- Project cards.
- Responsive layout.
- Application navigation.
- Accessibility.
- Product interaction principles.

The design system is the visual source of truth.

Do not replace it with a generic SaaS design system.

### Source hierarchy

Use the following hierarchy when making implementation decisions:

1. This master development brief defines the detailed functional product scope.
2. The investor deck defines business positioning and the product narrative.
3. The design system defines the visual and interaction language.
4. Established software engineering practices guide implementation where the documents do not specify technical details.

Do not invent business traction, customer testimonials, provider approvals, verified talent, market statistics or existing customer relationships.

Distinguish implemented functionality from planned capabilities, simulated transactions and unvalidated business assumptions.

# 3. BRAND IDENTITY AND LOGO IMPLEMENTATION

The product name is **Kintovo**.

Before building the application interface, inspect the logo symbol on the first slide of the investor deck, immediately before the headline:

"The people behind Africa's next wave of growth."

Treat that symbol as the primary brand reference.

Your responsibilities are to:

1. Identify and study the mark and its proportions.
2. Recreate it faithfully as a clean, scalable vector asset where practical.
3. Establish the Kintovo wordmark treatment.
4. Create a consistent horizontal logo lockup.
5. Create an icon-only version.
6. Create appropriate light and dark variants.
7. Create a favicon and application icon.
8. Establish minimum sizing and clear-space rules.
9. Use the logo consistently across the public website, authentication screens, application navigation, dashboards, email templates and other product surfaces.

Do not introduce a completely unrelated logo.

Do not use generic AI-generated startup symbols, random geometric decorations or stock icons as a replacement for the supplied brand reference.

If the embedded logo cannot be extracted at sufficient resolution, recreate the visual mark based on the original reference and document any unavoidable interpretation.

The brand should look like one coherent technology company across every product surface.

# 4. PRODUCT DEFINITION

Kintovo is a curated, demand-led talent and project-execution network.

It helps global and African businesses understand what expertise they need, access suitable African specialists and creators, assemble teams around business objectives and coordinate delivery.

Kintovo is not simply a freelancer directory.

It is a platform that connects business discovery, talent selection, team formation, negotiation, project coordination, delivery, performance reporting and compensation records.

The fundamental product workflow is:

**Business objective → Project discovery → Proposed workstreams → Talent recommendations → Team assembly or individual hiring → Negotiation → Agreement → Project execution → Milestones → Review and approval → Reporting and settlement records.**

The primary proposition is coordinated project-team assembly.

The secondary proposition is direct individual specialist hiring.

Both must use the same underlying talent network, organisation records, trust systems, agreements, workspaces and administrative infrastructure.

## 4.1 Initial market

Nigeria is the first delivery market.

Buyers may be located anywhere.

The first target segment to investigate is digital-first businesses that want to understand, enter, localise for or grow among Nigerian customers but do not have sufficient local execution capacity.

Initial work categories can include:

- Market research.
- Local audience understanding.
- Business and marketing strategy.
- Localisation.
- Graphic design.
- Video editing.
- Content production.
- Digital marketing.
- Creator partnerships.
- Community management.
- Software and digital services.

The architecture must allow additional African markets and professional categories to be introduced later.

Do not present Kintovo as a fully operational pan-African network at launch.

## 4.2 Core product promise

A business should not need to understand every job title or know exactly which professionals it needs before using Kintovo.

It should be able to explain what it wants to accomplish.

Kintovo should help turn that objective into an editable project plan, identify the capabilities required, present suitable specialists and creators, and provide a structured environment in which the work can be completed.

# 5. USER TYPES AND ACCESS CONTROL

Build the product around distinct user types with appropriate interfaces and permissions.

## 5.1 Business buyers

Business users represent organisations that need specialists or coordinated project teams.

They must be able to:

- Register and authenticate.
- Create or join an organisation.
- Complete business onboarding.
- Add authorised organisation members.
- Describe their business and products.
- Submit business objectives.
- Create project briefs.
- Receive suggested workstreams.
- Request coordinated teams.
- Hire individuals.
- Browse and compare eligible specialists.
- Review recommendations.
- Create shortlists.
- Negotiate proposals.
- Accept agreements.
- Manage projects.
- Review deliverables.
- Approve milestones.
- Request revisions.
- Raise disputes.
- View financial obligations and payment records.
- Track creator campaign performance.
- Access project reports.
- Re-engage previous professionals.

Support organisation-level roles, such as owner, administrator, project manager and authorised team member.

The person who creates a project should not automatically grant every organisation member unlimited financial or administrative authority.

## 5.2 Talent and specialist users

A talent user is an independent professional offering services through Kintovo.

They must be able to:

- Register and authenticate.
- Complete professional onboarding.
- Build a profile.
- Select professional categories.
- Add skills and experience.
- Add portfolios and work samples.
- Explain their contribution to previous projects.
- Provide relevant market experience.
- Add languages.
- Set availability.
- Set indicative rates and engagement preferences.
- Complete applicable verification checks.
- Complete role-specific assessments.
- Receive relevant project invitations.
- Discover suitable opportunities.
- Submit proposals.
- Negotiate scope and pricing.
- Accept agreements.
- Participate in team projects.
- Access their project workspace.
- Manage assigned tasks.
- Upload deliverables.
- Submit milestones.
- Respond to revision requests.
- Raise disputes.
- View approved earnings and compensation records.
- Track payment status.
- Review previous engagements.

Talent profiles should distinguish professionals from creators while allowing one user to hold more than one relevant professional role.

## 5.3 Creator users

Creators require additional capabilities for campaign-based engagements.

A creator must be able to:

- Create a creator profile.
- List publishing platforms.
- Provide audience information and relevant evidence.
- Submit portfolio and content examples.
- State content categories and areas of expertise.
- Receive campaign invitations.
- Review campaign briefs.
- Accept or negotiate campaign terms.
- Review deliverables and usage rights.
- Submit content for approval.
- Publish approved content.
- View campaign links and referral codes.
- Track eligible campaign outcomes.
- Review fixed compensation and performance bonuses.
- Access campaign reports.

Creators must not automatically be treated as affiliates.

A UGC creator who creates content for a business without publishing to their own audience must be supported as a content-production professional.

## 5.4 Platform administrators and operations

Build a protected administrative environment.

Administrators and authorised operations staff must be able to:

- Review user applications.
- Review business onboarding.
- Review talent profiles.
- Manage verification records.
- Review portfolio evidence.
- Record practical assessments.
- Approve or reject verification requests.
- Review and manage project briefs.
- Assist with team assembly.
- Manage candidate shortlists.
- Invite suitable professionals.
- Monitor active projects.
- Investigate complaints.
- Review disputes.
- Manage campaign records.
- Monitor payment obligations.
- Reconcile provider transaction records.
- Review webhook events.
- Access audit trails.
- Manage notifications.
- Manage service categories.
- Configure platform settings.
- Access operational reports.
- Suspend or restrict accounts where authorised.
- Track platform-wide activity.

The admin portal must not expose sensitive identity documents to ordinary operations users or other customers without appropriate permission.

# 6. BRAND AND PRODUCT DESIGN REQUIREMENTS

The design system must be studied and translated into reusable design tokens and components before page implementation.

## 6.1 Colour system

Use the supplied design tokens:

| Role | Colour |
|---|---|
| Paper / background | #F7F5F0 |
| Surface / cards | #FFFFFF |
| Primary text / ink | #202522 |
| Secondary text / muted | #68716C |
| Borders / dividers | #E5E0D7 |
| Primary accent | #E45A3D |
| Accent soft | #FBEAE4 |
| Teal / positive states | #2E786D |
| Blue / informational | #496F8A |
| Amber / attention | #B77A32 |

Use colour semantically.

The main accent should be reserved for primary actions and important emphasis.

Use teal for successful or verified states, amber for attention, and clearly distinguish destructive and error states.

Do not introduce random colours.

## 6.2 Typography

Use:

- Inter Display for headings.
- Inter for body text and interface elements.

Recommended hierarchy:

- Main page titles: 24–28 px.
- Section titles: 18–20 px.
- Body: 14–16 px.
- Secondary information: 12–13 px.
- Small labels: approximately 11 px, uppercase and restrained tracking.

Typography should remain readable and consistent.

## 6.3 Spacing

Use a 4 px base spacing grid.

Use predictable spacing:

4, 8, 12, 16, 24, 32, 48 and 64 px.

Prefer generous section spacing and 16–24 px internal card padding.

## 6.4 Application layout

Desktop reference:

- Sidebar: 240–256 px.
- Top navigation: approximately 64 px.
- Main content maximum width: 1,200 px.

The application should have consistent navigation and clear separation between primary navigation, page content and contextual actions.

## 6.5 Responsive behaviour

The entire product must work on:

- Desktop.
- Laptop.
- Tablet.
- Mobile phones.

On mobile:

- Collapse navigation.
- Stack cards appropriately.
- Use full-width form controls.
- Keep important actions accessible.
- Make tables horizontally scrollable when appropriate.
- Preserve agreement and payment status visibility.
- Ensure dialogs and complex workflows remain usable.

Do not simply shrink desktop screens to fit mobile.

## 6.6 Interface quality

The product should feel:

- Professional.
- Calm.
- Trustworthy.
- Capable.
- Modern.
- Warm without being playful.
- Minimal without being empty.
- Information-rich without being cluttered.

Do not use excessive gradients, glassmorphism, decorative illustrations, giant rounded cards, random shadows or excessive animations.

Use meaningful empty states, loading states, error states, progress indicators, confirmation dialogs and clear feedback.

Accessibility must be considered throughout. Target WCAG 2.2 AA, including keyboard navigation, focus management, semantic HTML, contrast, form labels and screen-reader-friendly interactions.

# 7. PUBLIC WEBSITE AND ACCOUNT ACCESS

Build a complete responsive public-facing website.

The public website should communicate what Kintovo does to both sides of the network.

Required pages:

1. Home.
2. How It Works.
3. For Businesses.
4. For Professionals.
5. For Creators.
6. About Kintovo.
7. Sign In.
8. Create Account.
9. Contact / Support.
10. Privacy Policy.
11. Terms of Service.

Use clear and consistent positioning.

The primary website call to action should lead businesses into the project discovery journey.

Professionals and creators should have a separate onboarding route.

Do not publish unsupported claims about the number of professionals, clients, completed projects or platform results.

Legal pages must be clearly identified as draft documents requiring appropriate legal review before public production use. Do not invent legal approval or certification.

# 8. AUTHENTICATION AND USER ONBOARDING

Implement a real authentication system.

Required capabilities:

- Account registration.
- Secure sign-in.
- Sign-out.
- Email verification.
- Password reset.
- Session management.
- Protected routes.
- Role-based access control.
- Organisation membership.
- Invitations.
- Account status management.
- Appropriate administrative access restrictions.

Users should be routed to the correct onboarding journey based on their intended role.

A user may need both a buyer and a professional account context. Design the underlying model so that this possibility does not require duplicate email accounts.

Business users should complete organisation onboarding.

Talent users should complete professional onboarding.

Creators should complete creator-specific onboarding.

Do not allow a user to access another organisation's private projects, files, proposals, financial information or internal messages.

# 9. BUSINESS ONBOARDING AND GOAL DISCOVERY

This is one of Kintovo's most important product capabilities.

Build a structured onboarding and discovery workflow.

The business should be able to describe:

- Organisation name.
- Website.
- Industry.
- Business model.
- Product or service.
- Business location.
- Target market.
- Target audience.
- Current market presence.
- Business objective.
- Current capabilities.
- Previous attempts.
- Available budget.
- Deadline.
- Constraints.
- Expected outcomes.
- Existing resources.
- Relevant additional information.

Support two clear entry choices:

**Option A: I know what I need.**

For businesses with a clearly defined requirement, allow them to select a role or professional category and begin individual hiring.

**Option B: Help me plan.**

For businesses that know their desired outcome but need help determining the capabilities required, provide a guided discovery process.

The experience should explain the difference between these options without confusing the buyer.

Store responses persistently so buyers can return and continue incomplete briefs.

Allow businesses to edit their answers before formally submitting a brief.

# 10. AI-ASSISTED PROJECT DISCOVERY AND SCOPE GENERATION

Build an AI-assisted project planning service.

A business should be able to describe a goal in natural language.

Example:

"We want to launch our productivity application in Nigeria and acquire our first group of university students and young professionals."

The system should analyse the description and produce a structured draft project plan.

Possible workstreams might include:

- Local market research.
- Audience understanding.
- Competitor analysis.
- Localised messaging.
- Creative production.
- Creator distribution.
- Community activation.

The AI service should identify:

1. Possible workstreams.
2. Required professional roles.
3. Recommended capabilities.
4. Draft deliverables.
5. Dependencies.
6. Suggested milestones.
7. Relevant questions.
8. Potential project constraints.
9. Missing information.
10. Assumptions requiring human or buyer confirmation.

### 10.1 Editable recommendations

AI-generated recommendations must never automatically become binding project agreements.

The buyer must be able to:

- Accept a recommendation.
- Reject a recommendation.
- Edit a workstream.
- Add a workstream.
- Remove a workstream.
- Replace a recommended role.
- Change deliverables.
- Adjust the timeline.
- Adjust budget priorities.

### 10.2 AI transparency

The system must explain why each role is recommended.

Identify the assumptions on which recommendations are based.

Show which details are known and which details remain uncertain.

Do not generate unsupported legal, tax, licensing, incorporation or regulatory advice.

Do not present speculative market research as confirmed fact.

### 10.3 AI architecture

Create a provider-independent AI service layer.

Do not scatter model API calls across application components.

Implement:

- Structured prompts.
- Typed and schema-validated outputs.
- Server-side API calls.
- Appropriate error handling.
- Prompt versioning.
- Request logging with privacy safeguards.
- Configurable model selection.
- A controlled fallback when AI services are unavailable.

If model credentials are absent, the application must remain usable through saved templates and rules-based functionality.

AI outputs should remain drafts until reviewed.

# 11. TALENT PROFILES AND PROFESSIONAL NETWORK

Build complete specialist profiles.

Each profile should support:

- Profile photo or avatar.
- Name.
- Professional headline.
- Short biography.
- Location.
- Country.
- Professional categories.
- Skills.
- Years or description of relevant experience.
- Industry experience.
- Local-market knowledge.
- Languages.
- Portfolio.
- Work samples.
- Project history.
- Availability.
- Preferred engagement type.
- Indicative pricing.
- Assessment records.
- Verification records.
- On-platform delivery history.

Profiles must not contain fabricated credentials.

A professional should control which information is publicly visible.

Sensitive verification records must remain restricted.

### 11.1 Portfolio management

Users should be able to upload or attach portfolio evidence.

Support relevant formats and external portfolio URLs.

Each portfolio item should support:

- Title.
- Description.
- Category.
- Date.
- Media or file.
- External URL.
- The user's claimed contribution.
- Relevant skills.
- Permission and visibility settings.

Do not automatically claim that every submitted portfolio item has been independently verified.

### 11.2 Availability and pricing

Allow professionals to configure:

- Available / unavailable.
- Available from date.
- Preferred project duration.
- Preferred working arrangements.
- Indicative rates.
- Preferred payment currency where supported.

Indicative rates must not replace negotiated final engagement terms.

# 12. TRUST, VERIFICATION AND QUALITY ENGINE

Trust is central to the Kintovo proposition.

Do not use one generic verified badge that implies every dimension of quality has been independently checked.

Build separate verification dimensions.

### 12.1 Identity verification

Record whether identity verification has been requested, submitted, approved, rejected, expired or requires review.

Store sensitive evidence securely.

Only authorised personnel should access identity documents.

### 12.2 Portfolio and authorship review

Allow human reviewers to inspect:

- Portfolio ownership claims.
- Work samples.
- Project contribution statements.
- References.
- Relevant external evidence.

AI may assist with information extraction and inconsistency detection.

AI must not make unsupported fraud accusations.

### 12.3 Practical skills assessment

Support role-specific assessments.

An assessment should have:

- Assessment title.
- Professional category.
- Required skills.
- Instructions.
- Submission requirements.
- Assessment rubric.
- Reviewer.
- Submitted evidence.
- Score or structured outcome.
- Status.
- Review date.
- Appeal or correction record.

Assessment methods must relate to the actual professional work.

### 12.4 Local-market expertise

Allow evidence of market knowledge through relevant:

- Projects.
- Case studies.
- Structured questions.
- Practical scenarios.
- Work samples.
- Experience records.

Do not assume that a person's physical location or identity automatically establishes their market expertise.

### 12.5 Platform delivery history

Record genuine platform engagements.

Relevant records include:

- Completed milestones.
- On-time delivery.
- Accepted work.
- Revision patterns.
- Relevant client feedback.
- Dispute records.
- Completed projects.

Clearly distinguish verified platform history from external claims.

### 12.6 Human oversight and appeals

Consequential trust and assessment decisions must support human review.

Users should be able to request correction of inaccurate information and appeal applicable decisions.

Never infer competence, honesty or personality from faces, voice tone, protected traits or unrelated behavioural signals.

# 13. TALENT DISCOVERY AND MATCHING

Build a talent discovery system that supports both manual browsing and project-specific recommendations.

Talent should not be ranked using one universal popularity score.

A professional suitable for one project may be unsuitable for another.

### 13.1 Search and filters

Allow buyers to search by:

- Professional category.
- Skill.
- Industry.
- Location.
- Market expertise.
- Language.
- Availability.
- Indicative rate.
- Assessment status.
- Relevant experience.
- Engagement preference.

Support sorting, side-by-side comparison and shortlisting.

### 13.2 Explainable matching

Create project-specific recommendations.

Potential matching factors:

- Required skills.
- Relevant work samples.
- Industry experience.
- Market expertise.
- Language requirements.
- Availability.
- Budget compatibility.
- Relevant delivery history.
- Creator audience relevance where applicable.

For team assembly, consider:

- Coverage of all workstreams.
- Complementary skills.
- Project dependencies.
- Scheduling.
- Project budget.
- Whether a project lead is required.

Show the buyer why a professional is recommended.

Do not show only a percentage with no explanation.

### 13.3 Initial matching architecture

Begin with rules-based matching and human curation.

Build the matching logic as a replaceable service so that it can later support more advanced automated recommendations.

Do not make AI-based rankings a prerequisite for core functionality.

Allow emerging professionals with relevant evidence to appear in suitable searches.

Do not sell undisclosed ranking positions.

If promoted listings are introduced in the future, identify them clearly and keep them separate from evidence-based matching.

# 14. TWO ENGAGEMENT PATHS

Both engagement models must be supported.

## 14.1 Project-team assembly — primary path

This is the leading Kintovo experience.

The buyer describes a business objective.

The platform helps create:

- A project brief.
- Suggested workstreams.
- Required professional roles.
- Draft deliverables.
- Timeline.
- Budget plan.
- Talent recommendations.

The buyer reviews and edits the plan.

The buyer can:

- Accept the suggested team structure.
- Remove a role.
- Add a role.
- Replace a recommended professional.
- Browse other eligible professionals.
- Shortlist candidates.
- Request additional candidates.
- Ask operations staff for support.

The team must not be assembled automatically without buyer approval.

Support a project lead and multiple individual contributors.

## 14.2 Individual hiring — secondary path

For a clearly defined requirement, businesses should be able to browse and hire one specialist.

Example:

A business wants a video editor to produce five promotional videos.

The buyer should be able to:

1. Select the role.
2. Describe the requirement.
3. Set indicative budget and timeline.
4. Browse suitable profiles.
5. Compare professionals.
6. Shortlist candidates.
7. Request a proposal.
8. Negotiate.
9. Agree the terms.
10. Commence the project.

Both engagement paths must share the same contracts, workspaces, milestone, payment and trust systems.

# 15. PROPOSALS AND NEGOTIATION

Build a complete proposal and negotiation system.

A business should be able to create a project opportunity or directly invite a professional.

Professionals should be able to submit proposals.

A proposal should support:

- Proposed price.
- Currency.
- Deliverables.
- Quantity.
- Timeline.
- Estimated start date.
- Revision allowance.
- Usage rights.
- Licensing terms.
- Exclusivity where applicable.
- Dependencies.
- Expenses.
- Milestone structure.
- Assumptions.
- Exclusions.
- Additional conditions.

### 15.1 Negotiation

Allow both parties to:

- Submit an offer.
- Submit a counteroffer.
- Respond to a counteroffer.
- Propose revised scope.
- Adjust fees.
- Adjust deadlines.
- Discuss terms.
- Accept an offer.
- Decline.
- Withdraw an offer.

Maintain a complete version history.

Do not overwrite accepted proposal terms.

A negotiated and accepted proposal must create a versioned agreement.

### 15.2 Agreement management

Create a structured agreement containing:

- Parties.
- Project.
- Responsibilities.
- Deliverables.
- Fees.
- Currency.
- Milestones.
- Deadlines.
- Acceptance criteria.
- Review period.
- Revision terms.
- Usage rights.
- Cancellation terms.
- Dependencies.
- Payment conditions.

Both parties should be able to access the accepted version.

Once accepted, material changes must go through a formal change request.

# 16. PROJECT WORKSPACE AND COLLABORATION

Each project must have a dedicated workspace.

The workspace should function as the shared operational environment for the business, project lead and contributors.

Required modules:

### 16.1 Project overview

Show:

- Project title.
- Buyer organisation.
- Project lead.
- Team members.
- Project objective.
- Scope.
- Budget.
- Deadlines.
- Progress.
- Active milestone.
- Current status.
- Recent activity.

### 16.2 Work breakdown and tasks

Support tasks with:

- Title.
- Description.
- Assigned professional.
- Due date.
- Priority.
- Status.
- Dependencies.
- Attachments.
- Comments.
- Activity history.

Task states should include:

- To do.
- In progress.
- Blocked.
- Submitted.
- Approved.
- Cancelled.

### 16.3 Team management

Allow authorised users to:

- View members.
- View responsibilities.
- Add or remove members where permitted.
- View individual agreements.
- View assigned work.
- Track milestone status.

### 16.4 Project communication

Build project-level messaging.

Support:

- Message threads.
- Replies.
- File attachments.
- Timestamps.
- Read states where practical.
- Notifications.

Project messages must only be accessible to authorised project participants and administrators with appropriate permissions.

### 16.5 File management

Support secure file uploads and downloads.

Files must be associated with a project, task, milestone, portfolio or campaign as appropriate.

Use controlled access rather than public file URLs for sensitive content.

# 17. MILESTONE MANAGEMENT AND DELIVERY

Milestones are central to project execution.

A project should be broken into explicit milestones.

Each milestone must contain:

- Title.
- Description.
- Assigned contributor.
- Deliverables.
- Amount.
- Currency.
- Deadline.
- Acceptance criteria.
- Review window.
- Revision allowance.
- Status.
- Submission evidence.
- Approval history.

### 17.1 Submission workflow

A professional should be able to:

1. Open an assigned milestone.
2. Review requirements.
3. Upload work.
4. Add a submission message.
5. Submit the milestone.
6. Track buyer review.

### 17.2 Buyer review workflow

The buyer should be able to:

- Approve the submission.
- Request an allowed revision.
- Propose an agreed partial settlement.
- Raise a dispute.

### 17.3 Revisions

A revision request must contain:

- Explanation.
- Relevant acceptance criterion.
- Requested changes.
- Date.
- Revision number.
- Deadline where applicable.

Revision limits must follow the accepted agreement.

A buyer must not be able to use repeated revisions to introduce entirely new scope without an agreed change request.

### 17.4 Multiple contributors

In a multi-person project, each contributor should have their own assigned work and relevant payment obligations.

One contributor's delay must not automatically block payment for another contributor's separately accepted and funded milestone.

### 17.5 Status and history

Keep a complete timeline of milestone events.

Every approval, revision, dispute, release request and status transition should be recorded.

# 18. CHANGE REQUESTS, CANCELLATIONS AND DISPUTES

Build a formal change-management process.

If a buyer wants to change scope, deliverables, price or deadlines after acceptance, the buyer must submit a change request.

A change request should include:

- Current agreed terms.
- Proposed new terms.
- Reason.
- Fee impact.
- Timeline impact.
- Affected milestones.
- Supporting notes.

The other party must be able to accept or reject it.

The current agreement remains in force until both parties accept the amendment.

### 18.1 Dispute management

Allow authorised parties to open a dispute.

Capture:

- Project.
- Milestone.
- Parties.
- Issue type.
- Description.
- Supporting files.
- Timeline.
- Relevant agreement version.
- Relevant messages.
- Amount affected where applicable.
- Status.
- Assigned reviewer.
- Review notes.
- Resolution.
- Audit history.

Possible statuses:

- Open.
- Awaiting evidence.
- Under review.
- Awaiting response.
- Resolved.
- Escalated.
- Closed.

Implement an administrative review interface.

The system must not assume that every dispute can guarantee payment recovery.

Only disputed amounts should be subject to dispute-related handling where the contractual and authorised provider arrangements support this.

# 19. CREATOR CAMPAIGN MANAGEMENT

Build a dedicated creator campaign module integrated with the main project system.

Creator partnerships should not be an isolated marketplace detached from the main business workflow.

### 19.1 Campaign creation

A business should be able to create a campaign brief containing:

- Campaign name.
- Business objective.
- Target audience.
- Target geography.
- Product or service.
- Campaign dates.
- Platforms.
- Content requirements.
- Number and type of deliverables.
- Posting schedule.
- Usage rights.
- Approval requirements.
- Fixed creator fees.
- Performance bonus terms.
- Conversion rules.
- Attribution window.
- Exclusions.
- Refund treatment.
- Budget.
- Reporting requirements.

### 19.2 Compensation structures

Support three arrangements:

1. Fixed fee.
2. Hybrid fixed fee plus performance bonus.
3. Commission-only, where appropriate and mutually accepted.

The initial recommended structure to investigate is a fixed fee for specified deliverables with an optional bonus for agreed results.

Do not automatically treat all creator work as commission-only.

### 19.3 Content approval

Creators should be able to submit content for review.

Businesses should be able to:

- Approve.
- Request a revision within agreed limits.
- Reject with a clear explanation.
- Record publication approval.

Preserve approval history.

### 19.4 Tracking links and referral codes

Build a basic attribution system.

Support:

- Unique tracking links.
- Creator-specific referral codes.
- Campaign identifiers.
- Click events.
- Lead events where configured.
- Order events from a test or approved integration.
- Conversion timestamps.
- Attribution windows.
- Duplicate-event protection.
- Refund and cancellation adjustments.

### 19.5 Bonus calculation

Performance bonuses must use explicitly agreed rules.

Record:

- Eligible conversion event.
- Attribution method.
- Attribution window.
- Exclusions.
- Refund treatment.
- Commission percentage or fixed bonus.
- Caps.
- Reporting source.
- Calculation result.

Do not treat every click as a sale.

Do not count cancelled or refunded conversions as valid unless the agreement explicitly permits it.

Make the calculation transparent to both parties.

### 19.6 Campaign reporting

Show:

- Approved content.
- Published content.
- Clicks.
- Leads where configured.
- Eligible conversions.
- Refunds.
- Fixed fees.
- Earned bonuses.
- Campaign expenditure.
- Performance status.

Clearly distinguish real integrated data from manually entered or simulated test data.

# 20. COMPENSATION LEDGER AND PAYMENT INFRASTRUCTURE

This module requires particular care.

Kintovo is not itself being built as a payment company, custodian or escrow provider.

The product must separate commercial obligations from actual movement of money.

Implement a provider-independent payment architecture.

### 20.1 Compensation ledger

Create an internal financial record system that can record:

- Contracted fees.
- Milestone amounts.
- Accepted deliverables.
- Earned professional compensation.
- Creator fixed fees.
- Creator bonuses.
- Platform fees.
- Adjustments.
- Refunds.
- Partial settlements.
- Outstanding obligations.
- Provider transaction references.

A ledger entry is not proof that money has moved.

### 20.2 Payment obligation

Create payment obligations from accepted agreements and milestones.

Each obligation should contain:

- Internal reference.
- Project.
- Milestone.
- Payer.
- Payee.
- Amount.
- Currency.
- Applicable fees.
- Current state.
- Provider reference, if any.
- Environment.
- Audit information.

### 20.3 Provider abstraction

Build a payment adapter architecture.

Use a common interface for:

- Payment collection.
- Transaction status retrieval.
- Payout initiation.
- Payout status retrieval.
- Refund requests where supported.
- Webhook processing.
- Reconciliation.

Create integration adapters for evaluating Paga and Busha.

The system must not assume that either provider has approved Kintovo's exact marketplace, milestone-funding or third-party settlement model.

### 20.4 Important provider restrictions

The research and business strategy identify Paga and Busha as technical candidates, not confirmed escrow providers.

Paga's publicly documented collection and payout capabilities do not automatically establish approval for marketplace fund holding or conditional release.

Busha's API capabilities, including its Pledges functionality, do not automatically establish that the proposed marketplace model is approved.

Do not describe ordinary subsidiary accounts, internal ledger entries or payment requests as legal escrow.

### 20.5 Sandbox and simulation

The initial implementation must support:

- Mock payments.
- Approved sandbox transactions.
- Simulated successful collections.
- Simulated failed collections.
- Simulated payouts.
- Simulated refunds.
- Simulated webhook events.
- Payment reconciliation tests.

Every simulated transaction must be visibly identified as simulated.

Do not create the impression that real money has been collected or settled when it has not.

Live production payment operations must remain disabled until the appropriate business, provider and legal approvals have been obtained.

Do not use personal payment accounts or expose financial API secrets in browser code.

### 20.6 Webhook security

Implement:

- Signature verification where supported.
- Event deduplication.
- Idempotency.
- Unique transaction references.
- Retry handling.
- Failure logging.
- Reconciliation.
- Immutable event records.

A browser redirect or user screenshot must never be accepted as authoritative proof of payment.

# 21. REPORTING AND ANALYTICS

Build operational and business reporting into the product.

### Business reporting

Businesses should be able to review:

- Active projects.
- Completed projects.
- Project budgets.
- Agreed fees.
- Milestone progress.
- Delivery timelines.
- Outstanding approvals.
- Creator campaign results.
- Spending records.
- Project close-out reports.

### Talent reporting

Professionals should see:

- Profile performance where data is meaningful.
- Relevant invitations.
- Active engagements.
- Completed milestones.
- Approved earnings.
- Payment status.
- Client feedback.
- Work history.

### Admin reporting

Administrators should see:

- Qualified buyer accounts.
- Submitted briefs.
- Projects by status.
- Time to shortlist.
- Time to project start.
- Team assembly versus individual hiring.
- Talent by category.
- Verified professionals by role.
- Milestone completion.
- Disputes.
- Creator campaign results.
- Compensation obligations.
- Provider reconciliation status.

Avoid vanity metrics such as total registrations as the primary indicator of platform success.

Only calculate metrics from real records.

Clearly identify incomplete or simulated data.

# 22. NOTIFICATIONS

Build a central notification system.

Support in-app notifications and an email notification adapter.

Events should include:

- Account verification.
- Organisation invitation.
- New project invitation.
- New proposal.
- Counteroffer.
- Proposal acceptance.
- Agreement acceptance.
- New project message.
- Task assignment.
- Task deadline.
- Milestone submission.
- Revision request.
- Approval.
- Dispute opening.
- Dispute update.
- Payment status change.
- Campaign invitation.
- Content approval.
- Campaign performance update.

Users should be able to mark notifications as read and manage relevant notification preferences.

Do not send misleading payment-success emails based on simulated transactions without labelling them as simulations.

# 23. ADMINISTRATIVE OPERATIONS CONSOLE

Build a complete protected admin dashboard.

The administrator should have clear navigation to:

1. Overview.
2. Businesses.
3. Talent.
4. Creators.
5. Verification.
6. Assessments.
7. Project briefs.
8. Shortlists.
9. Projects.
10. Agreements.
11. Milestones.
12. Disputes.
13. Campaigns.
14. Compensation ledger.
15. Payment transactions.
16. Webhooks.
17. Reports.
18. Notifications.
19. Categories and service configuration.
20. Platform settings.
21. Audit logs.

All administrative operations must use explicit permissions.

Implement confirmation steps for destructive and consequential actions.

Track who performs each important administrative action and when.

Do not allow a normal user to gain administrative privileges through frontend state or URL manipulation.

# 24. DATABASE DESIGN

Use a relational database with properly defined relationships and constraints.

Design the schema before implementing complex features.

At minimum, establish domain entities covering:

### Identity and organisations

- User.
- UserRole.
- Session.
- Organisation.
- OrganisationMember.
- BusinessProfile.
- OrganisationInvitation.

### Talent

- TalentProfile.
- CreatorProfile.
- ProfessionalCategory.
- Skill.
- TalentSkill.
- PortfolioItem.
- Availability.
- ExperienceRecord.
- Assessment.
- AssessmentSubmission.
- VerificationCheck.
- VerificationEvidence.

### Business discovery

- GoalDiscovery.
- Brief.
- BriefResponse.
- Workstream.
- RoleRequirement.
- RecommendedTalent.
- RecommendationEvidence.
- Shortlist.
- ShortlistMember.

### Engagements

- Proposal.
- ProposalVersion.
- Counteroffer.
- Contract.
- ContractVersion.
- Project.
- ProjectMember.
- ChangeRequest.
- Task.
- TaskComment.
- FileAsset.
- ProjectMessage.

### Delivery

- Milestone.
- MilestoneSubmission.
- MilestoneReview.
- RevisionRequest.
- ApprovalRecord.
- Dispute.
- DisputeEvidence.
- Feedback.

### Creator campaigns

- Campaign.
- CampaignBrief.
- CampaignCreator.
- CreatorDeliverable.
- TrackingLink.
- ReferralCode.
- AttributionRule.
- AttributionEvent.
- Conversion.
- CampaignReport.

### Financial records

- CompensationLedgerEntry.
- PaymentObligation.
- ProviderTransaction.
- ProviderWebhookEvent.
- RefundRecord.
- PayoutRecord.
- ReconciliationRecord.

### Platform operations

- Notification.
- NotificationPreference.
- AuditLog.
- AdminAction.
- PlatformSetting.
- FeatureFlag.

Use appropriate:

- Primary keys.
- Foreign keys.
- Unique constraints.
- Indexes.
- Timestamps.
- Currency fields.
- Status enums.
- Soft deletion where justified.
- Transaction boundaries.

Store financial amounts using an appropriate decimal or integer minor-unit representation, never floating-point arithmetic.

Preserve historical agreement and payment records.

Use database transactions for consequential multi-record operations.

Do not store every module in one generic JSON field.

# 25. APPLICATION ARCHITECTURE

Inspect the available development environment before selecting implementation details.

If a project repository already exists, assess its structure, dependencies, framework and quality before modifying it.

Do not discard functioning code simply to adopt a preferred stack.

If the application is being created from scratch, use a maintainable modern stack based on:

- React and TypeScript.
- Next.js for the web application.
- A properly structured server-side backend.
- PostgreSQL for persistent relational data.
- Prisma or an equivalent typed ORM.
- A secure authentication solution.
- Reusable frontend components.
- Schema validation for requests.
- Secure object storage for uploaded files.
- A notification and email service adapter.
- A background job mechanism where needed.
- A provider-independent AI service.
- A provider-independent payment service.
- Automated testing.

Use a modular monolith initially unless a strong technical reason requires separate services.

Organise the code by domain rather than putting the entire product in a collection of oversized files.

Separate:

- Presentation.
- Business logic.
- Data access.
- Authentication.
- Permissions.
- External integrations.
- Background processing.
- Validation.
- Observability.

Never expose secret keys or privileged backend operations to the browser.

Provide a documented environment configuration.

# 26. SECURITY, PRIVACY AND DATA GOVERNANCE

Security must be designed into the product from the beginning.

Implement:

- Role-based access control.
- Organisation-level data isolation.
- Server-side authorisation.
- Secure password handling.
- Secure session management.
- Input validation.
- Output encoding.
- Protection against common injection and cross-site scripting vulnerabilities.
- CSRF protection where applicable.
- Rate limiting.
- Secure file handling.
- Signed access to private files.
- Sensitive data restrictions.
- Audit logs.
- Secure API key management.
- Database backup guidance.
- Error handling that does not reveal sensitive information.

Apply data minimisation.

Collect only information needed for the platform's functionality.

Keep identity evidence private.

Define retention and deletion policies.

Support appropriate correction and deletion requests, subject to legitimate legal and financial recordkeeping requirements.

Review applicable data protection, consumer protection, contracting and payment rules before production launch.

Do not present an automated assessment or ranking as an objective measure of a person's overall worth or ability.

# 27. PRODUCT STATE MACHINES AND BUSINESS LOGIC

Important workflows must have explicit state transitions.

Do not allow arbitrary status changes from the frontend.

Define validated transitions for:

- Account verification.
- Talent verification.
- Brief lifecycle.
- Recommendation lifecycle.
- Proposal lifecycle.
- Negotiation lifecycle.
- Contract lifecycle.
- Project lifecycle.
- Milestone lifecycle.
- Dispute lifecycle.
- Campaign lifecycle.
- Payment obligation lifecycle.
- Provider transaction lifecycle.

Example proposal states:

Draft → Sent → Countered → Accepted / Declined / Withdrawn / Expired.

Example milestone states:

Draft → Awaiting Funding → Funded → In Progress → Submitted → In Review → Approved / Revision Requested / Disputed.

Example payment states:

Created → Pending → Funded → Release Pending → Released.

Additional states must cover failed, refunded, disputed and partially settled cases where applicable.

A simulated state must never be confused with a provider-confirmed state.

Use central business logic to enforce valid transitions.

# 28. REQUIRED USER INTERFACE STRUCTURE

Create the following application areas.

### Public

- Home.
- Product explanation.
- Business information.
- Professional information.
- Creator information.
- About.
- Contact.
- Authentication.

### Business application

- Business overview.
- Organisation settings.
- Goal discovery.
- Brief creation.
- Brief history.
- AI-generated scope review.
- Workstream editor.
- Team recommendations.
- Talent search.
- Talent comparison.
- Shortlists.
- Proposal management.
- Negotiations.
- Agreements.
- Projects.
- Project workspaces.
- Tasks.
- Milestones.
- Reviews.
- Disputes.
- Campaigns.
- Campaign reports.
- Financial records.
- Notifications.
- Team settings.

### Talent application

- Professional overview.
- Profile.
- Portfolio.
- Skills.
- Assessment.
- Verification.
- Availability.
- Opportunity discovery.
- Invitations.
- Proposals.
- Negotiations.
- Agreements.
- Active projects.
- Workspace.
- Tasks.
- Milestones.
- Submissions.
- Earnings and compensation records.
- Campaign invitations.
- Notifications.
- Account settings.

### Creator application

Include creator-specific dashboards for:

- Profile.
- Audience and channels.
- Campaign discovery.
- Campaign invitations.
- Compensation terms.
- Content submission.
- Content approval.
- Tracking.
- Results.
- Earnings.
- Campaign history.

### Administrative application

Include the complete administrative console specified earlier.

Navigation should be role-aware.

Users should not see irrelevant menus belonging to another user type.

# 29. TESTING AND QUALITY ASSURANCE

Do not consider development complete simply because the application builds.

Write and execute meaningful tests.

### 29.1 Unit tests

Test business logic such as:

- Brief validation.
- Matching calculations.
- Proposal transitions.
- Agreement versioning.
- Milestone transitions.
- Compensation calculations.
- Creator bonus calculations.
- Attribution rules.
- Payment state transitions.
- Permissions.

### 29.2 Integration tests

Test:

- Authentication.
- Database persistence.
- Organisation access restrictions.
- API permissions.
- File access.
- Notifications.
- AI service fallback.
- Mock payment adapter.
- Webhook processing.
- Ledger reconciliation.

### 29.3 End-to-end tests

At minimum, verify these journeys.

**Business journey**

A business creates an account, establishes an organisation, submits a business objective, receives a draft plan, edits the workstreams, chooses team assembly, reviews candidates, negotiates terms, accepts an agreement and creates a project.

**Individual hiring journey**

A buyer chooses a professional category, browses profiles, shortlists a professional, negotiates a proposal and accepts an individual engagement.

**Talent journey**

A professional creates a profile, adds portfolio evidence, completes onboarding, receives an invitation, submits a proposal, accepts an agreement and completes an assigned milestone.

**Project delivery journey**

A buyer and professional work within a workspace, submit deliverables, review work, request a revision, approve the milestone and record the resulting compensation obligation.

**Dispute journey**

A party raises a dispute, submits evidence, the authorised administrator reviews the case and records a resolution.

**Creator journey**

A business creates a campaign, invites creators, agrees compensation, approves content, tracks test conversions and generates a campaign report.

**Payment journey**

A buyer creates a simulated payment obligation, the mock or approved sandbox payment adapter processes the test event, the webhook handler verifies and records it, the ledger is updated appropriately and the system displays the correct simulation or sandbox status.

**Administrative journey**

An authorised administrator reviews talent evidence, updates verification status, manages a brief and accesses relevant audit records.

### 29.4 Regression testing

Every major new feature must be tested against existing workflows.

Do not break the business journey when modifying the talent dashboard or payment infrastructure.

### 29.5 Accessibility testing

Test:

- Keyboard navigation.
- Form labels.
- Focus indicators.
- Colour contrast.
- Responsive behaviour.
- Semantic structure.
- Error announcements.

# 30. DEMO AND TEST DATA

Create seed data for local development and automated testing.

Include clearly fictional:

- Business organisations.
- Talent profiles.
- Creator profiles.
- Projects.
- Proposals.
- Agreements.
- Tasks.
- Milestones.
- Campaigns.
- Payment records.
- Notifications.

Clearly identify test accounts and simulated data.

Do not present fictional users as actual verified Kintovo professionals.

Do not seed real identity documents or sensitive personal information.

Provide a documented way to create test administrator, buyer and talent accounts.

# 31. DEPLOYMENT AND OPERATIONS

The final application must be suitable for deployment.

Provide:

- Production build configuration.
- Database migrations.
- Environment variable documentation.
- Secure secret handling.
- Seed scripts.
- Docker configuration where appropriate.
- Health checks.
- Error monitoring guidance.
- Logging.
- Backup and recovery guidance.
- Deployment instructions.
- Database migration instructions.
- Rollback strategy.
- Integration configuration documentation.

Provide an `.env.example` file containing variable names and placeholder values only.

Never commit secrets.

The application must run locally using documented instructions.

Production deployment should be performed only with authorised infrastructure accounts and the required configuration.

Where deployment credentials or provider access are missing, clearly document the remaining external steps rather than claiming deployment has succeeded.

# 32. PRODUCT BOUNDARIES AND DEFERRED CAPABILITIES

Build a complete functioning product within the defined Kintovo scope.

However, the architecture must distinguish implemented and approved capabilities from features awaiting commercial, provider or legal approval.

The following must not be falsely represented as active production capabilities:

- Live marketplace escrow.
- Custody of third-party funds.
- Unapproved conditional payment release.
- Unapproved provider integrations.
- Multi-country payout support.
- Automated tax or legal compliance decisions.
- Fully automated high-stakes talent assessment.

The following expansion capabilities may be architecturally prepared but should not be falsely advertised as available:

- A fully open international talent marketplace.
- Multiple African delivery countries.
- Fully automated AI matching.
- Complex multi-touch creator attribution.
- Native Android and iOS applications.
- Full legal and regulatory market-entry consulting.

The initial commercial focus remains a curated Nigeria-first execution network.

Do not expand the product into an unrelated general-purpose marketplace.

# 33. IMPLEMENTATION PROCESS

Work in structured development phases.

Do not attempt to build the whole product in one enormous, unreviewed code-generation step.

Each phase must produce tested and integrated functionality.

## Phase 1: Discovery and technical architecture

- Inspect both supplied documents.
- Inspect the logo and design system.
- Establish the product requirements.
- Create an implementation specification.
- Define the technical architecture.
- Define the database entities and relationships.
- Define the user roles and permissions.
- Define the principal workflows.
- Define design tokens.
- Identify external integrations and approval dependencies.

Deliverable: approved technical architecture and implementation plan.

## Phase 2: Project foundation and brand system

- Establish the application repository.
- Configure the framework.
- Configure database access.
- Establish authentication.
- Implement role-based access.
- Build the Kintovo brand assets.
- Implement design tokens.
- Create the reusable component library.
- Establish the global layout and responsive navigation.
- Create baseline tests.

Deliverable: working application foundation.

## Phase 3: Authentication and onboarding

Implement:

- Registration.
- Sign-in.
- Email verification.
- Password reset.
- Organisation creation.
- Organisation membership.
- Business onboarding.
- Talent onboarding.
- Creator onboarding.
- Role-specific dashboards.

Deliverable: fully functional account and onboarding system.

## Phase 4: Business discovery and project planning

Implement:

- Goal discovery.
- Brief creation.
- AI-assisted scoping.
- Editable workstreams.
- Role recommendations.
- Brief submission.
- Administrative brief review.

Deliverable: complete business discovery journey.

## Phase 5: Talent network and trust

Implement:

- Professional profiles.
- Portfolio management.
- Skills.
- Availability.
- Assessments.
- Verification records.
- Search.
- Filters.
- Shortlisting.
- Explainable matching.
- Administrative review.

Deliverable: functional talent network.

## Phase 6: Engagement and negotiation

Implement:

- Team assembly.
- Individual hiring.
- Invitations.
- Proposals.
- Counteroffers.
- Negotiations.
- Versioned agreements.
- Formal acceptance.

Deliverable: working hiring and contracting workflows.

## Phase 7: Project delivery

Implement:

- Project creation.
- Team workspaces.
- Tasks.
- Messages.
- File management.
- Milestones.
- Submissions.
- Review.
- Revisions.
- Change requests.
- Disputes.
- Completion.

Deliverable: working project delivery system.

## Phase 8: Creator campaigns

Implement:

- Campaign creation.
- Creator invitations.
- Campaign contracts.
- Fixed and hybrid compensation.
- Content submission.
- Content approval.
- Links and referral codes.
- Test attribution.
- Bonus calculations.
- Reporting.

Deliverable: complete creator campaign workflow.

## Phase 9: Financial operations

Implement:

- Compensation ledger.
- Payment obligations.
- Provider abstraction.
- Mock payment adapter.
- Paga integration evaluation.
- Busha integration evaluation.
- Sandbox support where approved.
- Webhook handling.
- Reconciliation.
- Refund and adjustment records.
- Administrative financial monitoring.

Deliverable: functional payment-record and simulated settlement system.

## Phase 10: Analytics and administration

Implement:

- Administrative overview.
- Platform reports.
- Business reports.
- Talent reports.
- Campaign reports.
- Notifications.
- Audit records.
- Platform configuration.

Deliverable: complete operational management environment.

## Phase 11: Testing and hardening

- Execute unit tests.
- Execute integration tests.
- Execute end-to-end tests.
- Fix bugs.
- Review security.
- Check accessibility.
- Review responsive behaviour.
- Test permissions.
- Test failure states.
- Test recovery and reconciliation.
- Validate the complete business journey.

Deliverable: tested and stable application.

## Phase 12: Deployment readiness

- Configure production settings.
- Document deployment.
- Document migrations.
- Prepare environment templates.
- Prepare backups and monitoring.
- Confirm all unfinished external dependencies.
- Produce the final technical handover.

Deliverable: deployment-ready Kintovo platform.

# 34. NON-NEGOTIABLE DEVELOPMENT RULES

1. Build actual functionality, not just visual screens.
2. Use persistent database records.
3. Every important form must work.
4. Every primary action must have a functional result.
5. Implement server-side permissions.
6. Never rely on frontend-only role checks.
7. Keep business logic separate from UI components.
8. Keep payment providers replaceable.
9. Do not claim that simulated payments are real.
10. Do not call an unapproved arrangement escrow.
11. Keep AI recommendations editable and explainable.
12. Preserve human oversight for consequential decisions.
13. Do not manufacture verification evidence.
14. Do not fabricate project traction or customer data.
15. Preserve the Kintovo design system.
16. Make the application responsive.
17. Build meaningful empty, loading, error and success states.
18. Maintain an audit trail for important commercial and administrative events.
19. Test every critical workflow.
20. Document all outstanding dependencies and limitations honestly.

# 35. DEFINITION OF COMPLETION

The product must not be declared complete because the homepage looks good or the dashboards render correctly.

Kintovo is ready for final handover only when the following conditions are satisfied:

### Product

- The public website works.
- Registration and authentication work.
- Business onboarding works.
- Talent onboarding works.
- Creator onboarding works.
- Business goal discovery works.
- Project briefs persist.
- AI-assisted scoping works with an appropriate fallback.
- Workstream recommendations are editable.
- Talent profiles persist.
- Portfolio uploads work.
- Verification records work.
- Talent search and matching work.
- Team assembly works.
- Individual hiring works.
- Proposals and counteroffers work.
- Agreements are versioned.
- Project workspaces work.
- Tasks and messages work.
- Milestone submissions work.
- Reviews and revisions work.
- Change requests work.
- Dispute records work.
- Creator campaign management works.
- Attribution logic works for supported data sources.
- Compensation records work.
- Simulated or authorised sandbox payment workflows work.
- Administrative operations work.
- Notifications work.
- Reports work.

### Engineering

- The application builds successfully.
- Database migrations work.
- Data persists correctly.
- User permissions are enforced.
- Critical tests pass.
- The application works across supported screen sizes.
- No primary interaction is a dead button.
- No critical page depends on hardcoded mock content as its actual operating logic.
- No sensitive credentials are exposed.
- Error handling is implemented.
- Deployment instructions are complete.

### Handover

Provide:

1. The complete source code.
2. Database schema and migrations.
3. Setup instructions.
4. Environment variable documentation.
5. Test instructions and test results.
6. Seed data instructions.
7. Architecture documentation.
8. Integration documentation.
9. Security considerations.
10. Deployment guide.
11. Outstanding external dependencies.
12. Known limitations.
13. A functional walkthrough of every major user journey.

# 36. FIRST ACTION

Do not immediately generate pages or write large amounts of code.

Start by carefully studying the two attached PDFs.

First, understand the Kintovo brand, business model, product scope and design system.

Then return a structured technical discovery report containing:

1. Your understanding of Kintovo.
2. Your interpretation of the logo and brand identity.
3. The complete product module map.
4. The user roles and permission structure.
5. The proposed technical architecture.
6. The database design approach.
7. The complete workflow map.
8. The external integrations and their approval dependencies.
9. The development phases.
10. Any genuine contradictions or missing information in the supplied materials.

After producing that discovery report, proceed into implementation using this master brief as the product specification.

Make reasonable technical decisions where the documents are silent. Document consequential assumptions. Do not repeatedly stop to ask questions that can be resolved through good engineering judgement.

Keep the application runnable throughout development.

**The objective is to build Kintovo: a complete, functioning, professional-grade platform that turns business objectives into coordinated teams, managed engagements and delivered work.**