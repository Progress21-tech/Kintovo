import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/server/db";
import { privacyVersion, termsVersion } from "../src/server/policies";

/**
 * Local development and test data. Every organisation, person, project, campaign and
 * payment record here is FICTIONAL and labelled as such. Payment records are
 * simulated (MOCK provider). Nothing here is a verified Kintovo professional.
 *
 * Run: ENABLE_DEMO_SEED=1 npm run db:seed   (refuses to run with NODE_ENV=production)
 */
const PASSWORD = "Kintovo-demo-only!2026";
const day = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day);

async function person(email: string, name: string, platformRole: "USER" | "OPERATIONS" | "FINANCE" | "ADMIN" = "USER") {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const consent = { termsAcceptedAt: new Date(), termsVersion, privacyAcceptedAt: new Date(), privacyVersion };
  return db.user.upsert({
    where: { email },
    create: { email, name, passwordHash, platformRole, emailVerifiedAt: new Date(), ...consent },
    update: { name, passwordHash, platformRole, emailVerifiedAt: new Date(), disabledAt: null, bannedAt: null, ...consent },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_SEED !== "1") {
    throw new Error("Demo seed is disabled. Set ENABLE_DEMO_SEED=1 in a local development environment only.");
  }

  // ── Accounts ────────────────────────────────────────────────────────────────
  const admin = await person("admin@example.test", "Demo Admin (fictional)", "ADMIN");
  const ops = await person("ops@example.test", "Demo Operations Reviewer (fictional)", "OPERATIONS");
  const finance = await person("finance@example.test", "Demo Finance Officer (fictional)", "FINANCE");
  const buyer = await person("buyer@example.test", "Demo Buyer (fictional)");
  const pm = await person("pm@example.test", "Demo Project Manager (fictional)");
  const ada = await person("specialist@example.test", "Ada Example (fictional specialist)");
  const kemi = await person("researcher@example.test", "Kemi Example (fictional specialist)");
  const new1 = await person("newtalent@example.test", "Bayo Example (fictional, awaiting review)");
  const tunde = await person("creator@example.test", "Tunde Example (fictional creator)");

  // ── Organisation ────────────────────────────────────────────────────────────
  const org = await db.organisation.upsert({
    where: { id: "demo-company-fictional" },
    create: { id: "demo-company-fictional", name: "Demo Company (fictional)", website: "https://example.com", industry: "Productivity software", model: "B2C subscription", product: "Study-planning mobile app (fictional)", location: "Remote · buyer outside Nigeria" },
    update: { name: "Demo Company (fictional)" },
  });
  for (const [userId, role, canApproveSpend] of [[buyer.id, "OWNER", true], [pm.id, "PROJECT_MANAGER", false]] as const) {
    await db.organisationMembership.upsert({ where: { organisationId_userId: { organisationId: org.id, userId } }, create: { organisationId: org.id, userId, role, canApproveSpend }, update: { role, canApproveSpend } });
  }

  // ── Platform configuration ─────────────────────────────────────────────────
  for (const key of ["CAMPAIGNS_ENABLED", "MANUAL_ATTRIBUTION_ENABLED", "NEW_PROJECTS_ENABLED"]) {
    await db.platformSetting.upsert({ where: { key }, create: { key, value: true, updatedById: admin.id }, update: {} });
  }
  for (const [level, amount] of [["LEVEL_1", 400_000], ["LEVEL_2", 900_000], ["LEVEL_3", 2_000_000], ["LEVEL_4", 5_000_000]] as const) {
    await db.rateCeiling.upsert({ where: { currency_level: { currency: "NGN", level } }, create: { currency: "NGN", level, amount, updatedById: admin.id }, update: {} });
  }

  // ── Talent ──────────────────────────────────────────────────────────────────
  const adaProfile = await db.professionalProfile.upsert({
    where: { userId: ada.id },
    create: { userId: ada.id, headline: "Video editor for short-form launch content (fictional)", biography: "Fictional demo profile. Edits short-form product videos for Nigerian audiences.", city: "Lagos", languages: ["English", "Yoruba"], categories: ["Video editing", "Content production"], skills: ["Video editing", "Motion graphics", "Creative production", "Localised messaging"], availabilityStatus: "AVAILABLE", preferredEngagements: ["Team project", "Individual engagement"], indicativeRate: 350_000, yearsExperience: 5, expertiseLevel: "LEVEL_2", marketExperience: "Nigeria consumer apps and student audiences (self-reported, fictional)", onboardingCompletedAt: new Date(), isPublished: true },
    update: { isPublished: true },
  });
  const kemiProfile = await db.professionalProfile.upsert({
    where: { userId: kemi.id },
    create: { userId: kemi.id, headline: "Market researcher, Nigerian student and youth segments (fictional)", biography: "Fictional demo profile. Runs audience interviews and competitor scans.", city: "Ibadan", languages: ["English", "Yoruba", "Pidgin"], categories: ["Market research", "Business and marketing strategy"], skills: ["Audience research", "Competitor analysis", "Survey design", "Local market research"], availabilityStatus: "AVAILABLE", preferredEngagements: ["Team project"], indicativeRate: 600_000, yearsExperience: 7, expertiseLevel: "LEVEL_3", marketExperience: "Nigeria higher-education and fintech research (self-reported, fictional)", onboardingCompletedAt: new Date(), isPublished: true },
    update: { isPublished: true },
  });
  const newProfile = await db.professionalProfile.upsert({
    where: { userId: new1.id },
    create: { userId: new1.id, headline: "Community manager (fictional, unpublished)", biography: "Fictional demo profile awaiting human review.", languages: ["English", "Hausa"], categories: ["Community management"], skills: ["Community activation", "Moderation"], availabilityStatus: "AVAILABLE_FROM", availableFrom: at(14), onboardingCompletedAt: new Date(), isPublished: false },
    update: {},
  });
  const tundeCreator = await db.creatorProfile.upsert({
    where: { userId: tunde.id },
    create: { userId: tunde.id, biography: "Fictional demo creator covering student productivity.", platforms: ["Instagram", "TikTok"], contentCategories: ["Education", "Productivity"], audienceEvidence: "Fictional — no real audience data.", audienceSize: 12_000, audienceGeography: "Nigeria (fictional)", onboardingCompletedAt: new Date(), isPublished: true },
    update: { isPublished: true },
  });

  const existing = await db.project.findUnique({ where: { id: "seed-project-active" }, select: { id: true } });
  if (existing) {
    console.info("Demo records already exist; accounts and passwords were refreshed. Delete the local database to reseed records.");
    return printAccounts();
  }

  await db.portfolioItem.createMany({ data: [
    { profileId: adaProfile.id, title: "Launch teaser edit (fictional sample)", description: "Three 20-second cut-downs for a fictional app launch.", category: "Video editing", url: "https://example.com/fictional-teaser", contribution: "Edited and graded all three cuts; motion text.", skills: ["Video editing", "Motion graphics"], isPublic: true, occurredAt: at(-120) },
    { profileId: kemiProfile.id, title: "Student budgeting app interviews (fictional sample)", description: "Twelve interviews summarised into a segment map.", category: "Market research", url: "https://example.com/fictional-research", contribution: "Designed the guide, ran interviews, wrote the synthesis.", skills: ["Audience research"], isPublic: true, occurredAt: at(-200) },
  ] });
  await db.trustReview.createMany({ data: [
    { professionalProfileId: adaProfile.id, dimension: "PORTFOLIO_SKILLS", status: "APPROVED", evidenceNote: "Fictional seed evidence.", reviewerId: ops.id, reviewerNote: "Seed data: approved for local testing only.", reviewedAt: new Date() },
    { professionalProfileId: kemiProfile.id, dimension: "PORTFOLIO_SKILLS", status: "APPROVED", evidenceNote: "Fictional seed evidence.", reviewerId: ops.id, reviewerNote: "Seed data: approved for local testing only.", reviewedAt: new Date() },
    { professionalProfileId: kemiProfile.id, dimension: "LOCAL_EXPERTISE", status: "SUBMITTED", evidenceNote: "Fictional case study of Nigerian student research, awaiting review." },
    { professionalProfileId: newProfile.id, dimension: "PORTFOLIO_SKILLS", status: "SUBMITTED", evidenceNote: "Fictional community-growth samples awaiting review." },
    { creatorProfileId: tundeCreator.id, dimension: "PORTFOLIO_SKILLS", status: "APPROVED", evidenceNote: "Fictional creator samples.", reviewerId: ops.id, reviewerNote: "Seed data: approved for local testing only.", reviewedAt: new Date() },
  ] });
  await db.skillsAssessment.createMany({ data: [
    { professionalProfileId: kemiProfile.id, title: "Audience research practical", category: "Market research", requiredSkills: ["Survey design"], instructions: "Draft a 10-question screener for Nigerian university students.", status: "APPROVED", score: 82, reviewerId: ops.id, reviewerNote: "Seed data.", submittedAt: at(-30), reviewedAt: at(-28) },
    { professionalProfileId: adaProfile.id, title: "Short-form edit practical", category: "Video editing", requiredSkills: ["Video editing"], instructions: "Cut a 30-second vertical edit from supplied footage.", status: "SUBMITTED", submittedEvidenceUrl: "https://example.com/fictional-assessment", submittedAt: at(-2) },
  ] });

  // ── Active team project: agreement, milestones, tasks, messages ─────────────
  const project = await db.project.create({ data: {
    id: "seed-project-active", organisationId: org.id, createdById: buyer.id, title: "Nigeria student launch (fictional)", path: "TEAM", status: "ACTIVE",
    brief: { create: { objective: "Launch our study-planning app in Nigeria and acquire our first university students and young professionals.", targetAudience: "University students in Lagos and Ibadan", budgetMin: 1_000_000, budgetMax: 3_000_000, deadline: at(60), expectedOutcomes: "Validated messaging and first 500 sign-ups", scopeQuestions: ["Which universities are priorities?"], scopeAssumptions: ["Launch is mobile-first."] } },
    workstreams: { create: [
      { name: "Audience research", description: "Interview students and map segments.", capabilities: ["Audience research", "Local market research"], recommendedRoles: ["Market research"], deliverables: ["Segment map"], status: "APPROVED", rationale: "Messaging depends on verified audience insight." },
      { name: "Creative production", description: "Launch videos for short-form channels.", capabilities: ["Video editing", "Creative production"], recommendedRoles: ["Video editing"], deliverables: ["Five vertical videos"], status: "APPROVED", rationale: "Short-form video reaches the target audience." },
    ] },
  } });
  const engagements: { id: string; profileId: string; userId: string; amount: number; scope: string }[] = [];
  for (const [profile, user, amount, scope] of [[kemiProfile, kemi, 600_000, "Audience research: 12 interviews and a segment map."], [adaProfile, ada, 350_000, "Five 30-second vertical launch videos."]] as const) {
    const engagement = await db.engagement.create({ data: { projectId: project.id, professionalProfileId: profile.id, createdById: buyer.id, status: "ACTIVE", message: "Fictional seed invitation." } });
    const first = await db.proposal.create({ data: { engagementId: engagement.id, authorId: user.id, version: 1, amount: amount + 100_000, scope, deliverables: [scope], status: "SUPERSEDED", deadline: at(30) } });
    const counter = await db.proposal.create({ data: { engagementId: engagement.id, authorId: buyer.id, previousProposalId: first.id, version: 2, amount, scope, deliverables: [scope], status: "ACCEPTED", deadline: at(30), revisionAllowance: 2 } });
    const agreement = await db.agreement.create({ data: { engagementId: engagement.id, version: 1, status: "ACTIVE", acceptedAt: at(-10), buyerAcceptedAt: at(-10), talentAcceptedAt: at(-10), buyerAcceptedById: buyer.id, talentAcceptedById: user.id,
      terms: { create: { scope, deliverables: [scope], amount, currency: "NGN", dueAt: at(30), revisionAllowance: 2, acceptanceCriteria: ["Matches the agreed brief", "Delivered in agreed formats"], sourceProposalId: counter.id } } } });
    engagements.push({ id: engagement.id, profileId: profile.id, userId: user.id, amount, scope });
    const milestone = await db.milestone.create({ data: { projectId: project.id, assignedProfileId: profile.id, sourceAgreementId: agreement.id, title: profile.id === kemiProfile.id ? "Research synthesis" : "Launch video set", deliverables: [scope], amount, currency: "NGN", dueAt: at(profile.id === kemiProfile.id ? -1 : 20), acceptanceCriteria: ["Matches the agreed brief", "Delivered in agreed formats"], revisionAllowance: 2, status: profile.id === kemiProfile.id ? "APPROVED" : "SUBMITTED" } });
    await db.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: "IN_PROGRESS", toStatus: "SUBMITTED", note: "Fictional seed submission." } });
    await db.submission.create({ data: { milestoneId: milestone.id, submittedById: user.id, note: "Fictional seed deliverable; see the linked sample.", evidenceUrl: "https://example.com/fictional-deliverable" } });
    if (profile.id === kemiProfile.id) {
      await db.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: buyer.id, fromStatus: "IN_REVIEW", toStatus: "APPROVED", note: "Approved (seed data)." } });
      const obligation = await db.compensationObligation.create({ data: { reference: `MILESTONE-${milestone.id}`, projectId: project.id, milestoneId: milestone.id, recipientId: user.id, createdById: buyer.id, amount, currency: "NGN", status: "SIMULATED_PAID", provider: "MOCK", simulated: true, paidAt: new Date() } });
      await db.ledgerEntry.createMany({ data: [
        { obligationId: obligation.id, kind: "EARNED_ON_APPROVAL", amount, currency: "NGN", simulated: true, providerEventId: `approval:${milestone.id}` },
        { obligationId: obligation.id, kind: "SIMULATED_SETTLEMENT", amount, currency: "NGN", simulated: true, providerEventId: `mock_seed_${milestone.id}` },
      ] });
    }
  }
  await db.projectTask.createMany({ data: [
    { projectId: project.id, createdById: buyer.id, assigneeProfileId: adaProfile.id, title: "Storyboard the first two videos", priority: "HIGH", status: "IN_PROGRESS", dueAt: at(1) },
    { projectId: project.id, createdById: buyer.id, assigneeProfileId: kemiProfile.id, title: "Share interview recordings index", priority: "NORMAL", status: "APPROVED", dueAt: at(-3) },
    { projectId: project.id, createdById: pm.id, title: "Confirm brand assets folder", priority: "LOW", status: "TODO", dueAt: at(5) },
  ] });
  const thread = await db.projectMessage.create({ data: { projectId: project.id, authorId: buyer.id, body: "Welcome to the fictional launch workspace. Please post weekly updates here." } });
  await db.projectMessage.create({ data: { projectId: project.id, authorId: ada.id, parentId: thread.id, body: "Thanks — first storyboard draft coming this week." } });
  await db.dispute.create({ data: { projectId: project.id, openedById: pm.id, issueType: "Communication", description: "Fictional seed dispute: weekly update cadence was missed twice.", status: "OPEN" } });

  // ── Individual-hire project under negotiation ───────────────────────────────
  const hire = await db.project.create({ data: { id: "seed-project-hire", organisationId: org.id, createdById: buyer.id, title: "Five promotional videos (fictional)", path: "INDIVIDUAL", status: "MATCHING",
    brief: { create: { objective: "Hire a video editor to produce five promotional videos for app stores.", budgetMin: 200_000, budgetMax: 500_000, deadline: at(45) } },
    workstreams: { create: [{ name: "Video production", description: "Five app-store promo videos.", capabilities: ["Video editing"], recommendedRoles: ["Video editing"], deliverables: ["Five videos"], status: "APPROVED" }] } } });
  await db.talentShortlist.create({ data: { projectId: hire.id, professionalProfileId: adaProfile.id, createdById: buyer.id, note: "Strong short-form samples." } });
  const hireEngagement = await db.engagement.create({ data: { projectId: hire.id, professionalProfileId: adaProfile.id, createdById: buyer.id, status: "NEGOTIATING" } });
  const offer = await db.proposal.create({ data: { engagementId: hireEngagement.id, authorId: ada.id, version: 1, amount: 420_000, scope: "Five 30-second promo videos, two revision rounds.", deliverables: ["Five videos"], status: "COUNTERED", deadline: at(30) } });
  await db.proposal.create({ data: { engagementId: hireEngagement.id, authorId: buyer.id, previousProposalId: offer.id, version: 2, amount: 380_000, scope: "Five 30-second promo videos, two revision rounds.", deliverables: ["Five videos"], status: "OPEN", deadline: at(30) } });

  // ── Briefs in the review pipeline ───────────────────────────────────────────
  await db.project.create({ data: { id: "seed-project-submitted", organisationId: org.id, createdById: pm.id, title: "Campus ambassador programme (fictional)", path: "TEAM", status: "SUBMITTED", brief: { create: { objective: "Recruit and coordinate campus ambassadors at three universities." } } } });
  await db.project.create({ data: { id: "seed-project-draft", organisationId: org.id, createdById: buyer.id, title: "Localised onboarding copy (fictional draft)", status: "DRAFT", brief: { create: { objective: "Localise in-app onboarding copy for Nigerian English and Pidgin." } } } });

  // ── Creator campaign ────────────────────────────────────────────────────────
  const campaign = await db.campaign.create({ data: { organisationId: org.id, createdById: buyer.id, title: "Exam-season study tips (fictional)", brief: "Three short videos showing study planning during exam season.", objective: "Drive app sign-ups among students during exams.", targetAudience: "University students", targetGeography: "Nigeria", platforms: ["Instagram", "TikTok"], contentTypes: ["Short-form video"], usageRights: "Organic reposting for 6 months; no paid usage.", landingUrl: "https://example.com", status: "ACTIVE", startsAt: at(-20), endsAt: at(20), compensationModel: "HYBRID", attributionWindowDays: 14, conversionRule: "First paid subscription by a new user.", refundTreatment: "EXCLUDE_REFUNDED", budget: 600_000 } });
  const entry = await db.campaignCreator.create({ data: { campaignId: campaign.id, creatorId: tundeCreator.id, status: "ACTIVE", fixedFee: 150_000, bonusRate: 1000, bonusCap: 100_000, contractTerms: "Fictional seed terms: hybrid, 10% bonus on eligible orders, capped.", contractAcceptedAt: at(-18), acceptedAt: at(-18), referralCode: "seed-tunde-exam" } });
  await db.campaignContent.createMany({ data: [
    { campaignCreatorId: entry.id, title: "Study plan in 60 seconds", note: "Fictional seed content.", status: "PUBLISHED", reviewerId: buyer.id, reviewedAt: at(-10), publishedUrl: "https://example.com/fictional-post", publishedAt: at(-9) },
    { campaignCreatorId: entry.id, title: "Night-before-exam checklist", note: "Fictional seed content awaiting review.", status: "SUBMITTED" },
  ] });
  await db.campaignClick.createMany({ data: Array.from({ length: 24 }, (_, index) => ({ campaignCreatorId: entry.id, sourceEventId: `seed-click-${index}`, occurredAt: at(-15 + index * 0.5) })) });
  const conversion = await db.campaignAttribution.create({ data: { campaignCreatorId: entry.id, sourceEventId: "seed-order-1", orderReference: "FICTIONAL-ORDER-1", amount: 50_000, currency: "NGN", status: "APPROVED", reviewerId: finance.id, reviewedAt: at(-5), reviewerNote: "Seed test conversion.", bonusAmount: 5_000, occurredAt: at(-6), source: "WEBHOOK", eventType: "ORDER", simulated: true } });
  await db.campaignAttribution.create({ data: { campaignCreatorId: entry.id, sourceEventId: "seed-order-2", orderReference: "FICTIONAL-ORDER-2", amount: 30_000, currency: "NGN", status: "PENDING", occurredAt: at(-1), source: "MANUAL", eventType: "ORDER", simulated: true } });
  await db.compensationObligation.create({ data: { reference: `BONUS-${conversion.id}`, attributionId: conversion.id, recipientId: tunde.id, createdById: buyer.id, amount: 5_000, currency: "NGN", status: "PENDING", provider: "MOCK", simulated: true } });

  // ── Notifications ───────────────────────────────────────────────────────────
  await db.notification.createMany({ data: [
    { userId: buyer.id, category: "MILESTONE", title: "Milestone submitted for review", body: "Ada Example submitted “Launch video set”.", href: "/workspace/projects/seed-project-active" },
    { userId: buyer.id, category: "PROPOSAL", title: "Counteroffer awaiting response", body: "Your counteroffer on “Five promotional videos” is open.", href: "/workspace/projects/seed-project-hire" },
    { userId: kemi.id, category: "PAYMENT", title: "[Simulated] Compensation recorded", body: "A simulated settlement was recorded for “Research synthesis”. No money moved.", href: "/workspace/earnings" },
    { userId: tunde.id, category: "CAMPAIGN", title: "Content awaiting review", body: "“Night-before-exam checklist” is with the business for approval.", href: "/workspace/campaigns" },
    { userId: ops.id, category: "DISPUTE", title: "New dispute awaiting review", body: "Communication", href: "/workspace/operations/disputes" },
  ] });
  await db.auditLog.create({ data: { actorId: admin.id, action: "DEMO_SEED_LOADED", entityType: "Organisation", entityId: org.id, metadata: { fictional: true } } });
  return printAccounts();
}

function printAccounts() {
  console.info("\nFictional local accounts (password for all: %s):", PASSWORD);
  for (const [email, role] of [
    ["admin@example.test", "Platform Admin"], ["ops@example.test", "Operations reviewer"], ["finance@example.test", "Finance"],
    ["buyer@example.test", "Business owner (spend approver)"], ["pm@example.test", "Business project manager (no spend authority)"],
    ["specialist@example.test", "Specialist (video)"], ["researcher@example.test", "Specialist (research)"],
    ["newtalent@example.test", "Specialist awaiting review"], ["creator@example.test", "Creator"],
  ]) console.info(`  ${email.padEnd(26)} ${role}`);
  console.info("All records are fictional; payments are simulated. Never use these credentials outside local development.\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
