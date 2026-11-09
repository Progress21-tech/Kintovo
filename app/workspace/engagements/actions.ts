"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canApproveSpend, canManageProjects } from "@/server/permissions";

const splitLines = (value: string, max = 12) => [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))].slice(0, max);
function parseAmount(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); if (!text) return null; const amount = Number(text); return Number.isSafeInteger(amount) && amount >= 0 ? amount : NaN; }

export async function inviteShortlistedProfessional(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ projectId: z.string().min(1), profileId: z.string().min(1), message: z.string().trim().max(1500).optional() }).safeParse({ projectId: formData.get("projectId"), profileId: formData.get("profileId"), message: formData.get("message") });
  if (!input.success) return;
  const project = await db.project.findUnique({ where: { id: input.data.projectId }, select: { id: true, status: true, organisationId: true } });
  if (!project) return;
  const [membership, profile] = await Promise.all([
    db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } }),
    db.professionalProfile.findFirst({ where: { id: input.data.profileId, isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, select: { id: true, userId: true } }),
  ]);
  if (!membership || !canManageProjects(membership.role) || !["MATCHING", "ACTIVE"].includes(project.status) || !profile) return;
  const existing = await db.engagement.findUnique({ where: { projectId_professionalProfileId: { projectId: project.id, professionalProfileId: profile.id } }, select: { id: true } });
  if (existing) return;
  const engagement = await db.$transaction(async (tx) => {
    const created = await tx.engagement.create({
      data: { projectId: project.id, professionalProfileId: profile.id, createdById: user.id, status: "INVITED", message: input.data.message || null },
    });
    await tx.notification.create({ data: { userId: profile.userId, title: "Project invitation", body: "A business invited you to review a project opportunity on Kintovo." } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROFESSIONAL_INVITED_TO_PROJECT", entityType: "Engagement", entityId: created.id } });
    return created;
  });
  revalidatePath(`/workspace/projects/${project.id}`);
  revalidatePath("/workspace/opportunities");
  return engagement.id;
}

const proposalInput = z.object({
  engagementId: z.string().min(1),
  scope: z.string().trim().min(20).max(5000),
  amount: z.string().min(1),
  currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
  deliverables: z.string().trim().min(2).max(3000),
  assumptions: z.string().max(2000).optional(),
  exclusions: z.string().max(2000).optional(),
  revisionAllowance: z.string(),
  usageRights: z.string().max(1200).optional(),
  dependencies: z.string().max(1200).optional(),
  expenses: z.string().max(1200).optional(),
  deadline: z.string().optional(),
  estimatedStartAt: z.string().optional(),
  previousProposalId: z.string().optional(),
});

export async function submitProposal(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = proposalInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Review the proposal terms and try again." };
  const amount = parseAmount(formData.get("amount"));
  const revisionAllowance = Number(parsed.data.revisionAllowance);
  if (amount === null || Number.isNaN(amount)) return { error: "Enter a valid whole-number proposed fee." };
  if (!Number.isSafeInteger(revisionAllowance) || revisionAllowance < 0 || revisionAllowance > 10) return { error: "Revision allowance must be between 0 and 10." };
  const dueAt = parsed.data.deadline ? new Date(`${parsed.data.deadline}T12:00:00.000Z`) : null;
  const startAt = parsed.data.estimatedStartAt ? new Date(`${parsed.data.estimatedStartAt}T12:00:00.000Z`) : null;
  if (dueAt && Number.isNaN(dueAt.getTime()) || startAt && Number.isNaN(startAt.getTime())) return { error: "Enter valid proposal dates." };
  const engagement = await db.engagement.findUnique({ where: { id: parsed.data.engagementId }, include: { project: { select: { id: true, status: true, organisationId: true } }, professional: { select: { id: true, userId: true } }, proposals: { orderBy: { version: "desc" }, take: 1 } } });
  if (!engagement || !["INVITED", "PROPOSED", "NEGOTIATING"].includes(engagement.status)) return { error: "This opportunity is no longer open for proposals." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: engagement.project.organisationId, userId: user.id } } });
  const isTalent = engagement.professional.userId === user.id;
  const isBuyer = Boolean(membership && canManageProjects(membership.role));
  if ((!isTalent && !isBuyer) || (!parsed.data.previousProposalId && !isTalent)) return { error: "You cannot submit an offer for this opportunity." };
  if (parsed.data.previousProposalId) {
    const previous = engagement.proposals[0];
    if (!previous || previous.id !== parsed.data.previousProposalId || previous.status !== "OPEN" || previous.authorId === user.id) return { error: "Only the latest open offer from the other party can be countered." };
  } else if (engagement.proposals.length) return { error: "Respond to the latest proposal instead of starting a second offer." };
  const version = (engagement.proposals[0]?.version ?? 0) + 1;
  await db.$transaction(async (tx) => {
    if (parsed.data.previousProposalId) await tx.proposal.update({ where: { id: parsed.data.previousProposalId }, data: { status: "COUNTERED" } });
    const proposal = await tx.proposal.create({ data: {
      engagementId: engagement.id, authorId: user.id, previousProposalId: parsed.data.previousProposalId || null, version,
      amount, currency: parsed.data.currency, scope: parsed.data.scope, deliverables: splitLines(parsed.data.deliverables),
      assumptions: splitLines(parsed.data.assumptions ?? ""), exclusions: splitLines(parsed.data.exclusions ?? ""),
      revisionAllowance, usageRights: parsed.data.usageRights || null, dependencies: parsed.data.dependencies || null,
      expenses: parsed.data.expenses || null, deadline: dueAt, estimatedStartAt: startAt,
      status: "OPEN", expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    } });
    await tx.engagement.update({ where: { id: engagement.id }, data: { status: version > 1 ? "NEGOTIATING" : "PROPOSED" } });
    await tx.notification.create({ data: { userId: isTalent ? engagement.createdById : engagement.professional.userId, title: version > 1 ? "Counteroffer received" : "Proposal received", body: "Open the project workspace to review the updated proposal." } });
    await tx.auditLog.create({ data: { actorId: user.id, action: version > 1 ? "PROPOSAL_COUNTERED" : "PROPOSAL_SUBMITTED", entityType: "Proposal", entityId: proposal.id, metadata: { version } } });
  });
  revalidatePath("/workspace/opportunities");
  revalidatePath(`/workspace/projects/${engagement.project.id}`);
  return { success: "Your proposal was sent. The other party can accept, decline, or counter it." };
}

export async function counterProposal(_state: { error?: string; success?: string }, formData: FormData) {
  await requireUser();
  const previousId = z.string().min(1).safeParse(formData.get("previousProposalId"));
  if (!previousId.success) return { error: "The proposal could not be found." };
  const previous = await db.proposal.findUnique({ where: { id: previousId.data }, select: { id: true, engagementId: true } });
  if (!previous) return { error: "The proposal could not be found." };
  const forwarded = new FormData(formData);
  forwarded.set("engagementId", previous.engagementId);
  forwarded.set("previousProposalId", previous.id);
  return submitProposal({}, forwarded);
}

export async function declineProposal(formData: FormData) {
  const user = await requireUser();
  const proposalId = z.string().min(1).safeParse(formData.get("proposalId"));
  if (!proposalId.success) return;
  const proposal = await db.proposal.findUnique({ where: { id: proposalId.data }, include: { engagement: { include: { project: { select: { id: true, organisationId: true } }, professional: { select: { userId: true } } } } } });
  if (!proposal || proposal.status !== "OPEN") return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: proposal.engagement.project.organisationId, userId: user.id } } });
  const isBuyer = Boolean(membership && canManageProjects(membership.role));
  const isTalent = proposal.engagement.professional.userId === user.id;
  if (!isBuyer && !isTalent) return;
  if (proposal.authorId === user.id) {
    await db.proposal.update({ where: { id: proposal.id }, data: { status: "WITHDRAWN" } });
  } else {
    await db.proposal.update({ where: { id: proposal.id }, data: { status: "DECLINED" } });
    await db.engagement.update({ where: { id: proposal.engagementId }, data: { status: "CANCELLED" } });
  }
  await db.auditLog.create({ data: { actorId: user.id, action: proposal.authorId === user.id ? "PROPOSAL_WITHDRAWN" : "PROPOSAL_DECLINED", entityType: "Proposal", entityId: proposal.id } });
  revalidatePath(`/workspace/projects/${proposal.engagement.project.id}`);
  revalidatePath("/workspace/opportunities");
}

export async function acceptProposal(formData: FormData) {
  const user = await requireUser();
  const proposalId = z.string().min(1).safeParse(formData.get("proposalId"));
  if (!proposalId.success) return;
  const proposal = await db.proposal.findUnique({ where: { id: proposalId.data }, include: { engagement: { include: { project: { select: { id: true, organisationId: true } }, professional: { select: { userId: true } } } } } });
  if (!proposal || proposal.status !== "OPEN" || proposal.authorId === user.id) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: proposal.engagement.project.organisationId, userId: user.id } } });
  const isBuyer = Boolean(membership && canApproveSpend(membership.role, membership.canApproveSpend));
  const isTalent = proposal.engagement.professional.userId === user.id;
  if (!isBuyer && !isTalent) return;
  const existing = await db.agreement.findFirst({ where: { engagementId: proposal.engagementId } });
  if (existing) return;
  const agreement = await db.$transaction(async (tx) => {
    const created = await tx.agreement.create({ data: {
      engagementId: proposal.engagementId, version: 1, status: "PENDING_ACCEPTANCE",
      terms: { create: {
        scope: proposal.scope, deliverables: proposal.deliverables, amount: proposal.amount, currency: proposal.currency,
        revisionTerms: `${proposal.revisionAllowance} revision rounds`, dueAt: proposal.deadline, estimatedStartAt: proposal.estimatedStartAt,
        revisionAllowance: proposal.revisionAllowance, usageRights: proposal.usageRights, assumptions: proposal.assumptions, exclusions: proposal.exclusions,
        acceptanceCriteria: proposal.deliverables, sourceProposalId: proposal.id,
      } },
    } });
    await tx.proposal.update({ where: { id: proposal.id }, data: { status: "ACCEPTED" } });
    await tx.engagement.update({ where: { id: proposal.engagementId }, data: { status: "AGREED" } });
    await tx.notification.create({ data: { userId: proposal.authorId, title: "Proposal accepted", body: "The other party accepted your proposal. Review and accept the agreement terms to begin." } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROPOSAL_ACCEPTED_AGREEMENT_CREATED", entityType: "Agreement", entityId: created.id } });
    return created;
  });
  revalidatePath(`/workspace/projects/${proposal.engagement.project.id}`);
  revalidatePath("/workspace/opportunities");
  return agreement.id;
}

export async function acceptAgreement(formData: FormData) {
  const user = await requireUser();
  if (formData.get("acceptedTerms") !== "on") return;
  const agreementId = z.string().min(1).safeParse(formData.get("agreementId"));
  if (!agreementId.success) return;
  const agreement = await db.agreement.findUnique({ where: { id: agreementId.data }, include: { terms: true, engagement: { include: { project: { select: { id: true, organisationId: true } }, professional: { select: { id: true, userId: true } } } } } });
  if (!agreement || agreement.status !== "PENDING_ACCEPTANCE") return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: agreement.engagement.project.organisationId, userId: user.id } } });
  const isBuyer = Boolean(membership && canApproveSpend(membership.role, membership.canApproveSpend));
  const isTalent = agreement.engagement.professional.userId === user.id;
  if (!isBuyer && !isTalent) return;
  if (isBuyer && agreement.buyerAcceptedAt || isTalent && agreement.talentAcceptedAt) return;
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.agreement.update({ where: { id: agreement.id }, data: isBuyer ? { buyerAcceptedAt: now, buyerAcceptedById: user.id } : { talentAcceptedAt: now, talentAcceptedById: user.id } });
    const refreshed = await tx.agreement.findUniqueOrThrow({ where: { id: agreement.id } });
    const buyerAccepted = Boolean(refreshed.buyerAcceptedAt || isBuyer);
    const talentAccepted = Boolean(refreshed.talentAcceptedAt || isTalent);
    await tx.auditLog.create({ data: { actorId: user.id, action: isBuyer ? "BUYER_ACCEPTED_AGREEMENT" : "TALENT_ACCEPTED_AGREEMENT", entityType: "Agreement", entityId: agreement.id } });
    if (buyerAccepted && talentAccepted) {
      await tx.agreement.updateMany({ where: { engagementId: agreement.engagementId, status: "ACTIVE", id: { not: agreement.id } }, data: { status: "SUPERSEDED" } });
      await tx.agreement.update({ where: { id: agreement.id }, data: { status: "ACTIVE", acceptedAt: now } });
      await tx.engagement.update({ where: { id: agreement.engagementId }, data: { status: "ACTIVE" } });
      await tx.project.update({ where: { id: agreement.engagement.project.id }, data: { status: "ACTIVE" } });
      const existingMilestone = await tx.milestone.findFirst({ where: { sourceAgreementId: agreement.id } });
      if (!existingMilestone) await tx.milestone.create({ data: { sourceAgreementId: agreement.id, projectId: agreement.engagement.project.id, assignedProfileId: agreement.engagement.professional.id, title: agreement.version === 1 ? "Agreed project deliverables" : `Amended deliverables · agreement v${agreement.version}`, description: agreement.terms.scope, deliverables: agreement.terms.deliverables, amount: agreement.terms.amount, currency: agreement.terms.currency, dueAt: agreement.terms.dueAt, acceptanceCriteria: agreement.terms.acceptanceCriteria, revisionAllowance: agreement.terms.revisionAllowance } });
      await tx.notification.create({ data: { userId: isBuyer ? agreement.engagement.professional.userId : agreement.engagement.createdById, title: "Agreement active", body: "Both parties accepted the agreement. The project workspace is now active." } });
    }
  });
  revalidatePath(`/workspace/projects/${agreement.engagement.project.id}`);
  revalidatePath("/workspace/opportunities");
}
