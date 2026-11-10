"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { calculateCreatorBonus, validManualAttributionEventId } from "@/server/campaigns";
import { platformFlag } from "@/server/settings";

const currencies = ["NGN", "USD", "GBP", "EUR"] as const;
function integer(value: FormDataEntryValue | null, fallback = 0) { const raw = String(value ?? "").trim(); if (!raw) return fallback; const result = Number(raw); return Number.isSafeInteger(result) && result >= 0 && result <= 2_147_483_647 ? result : NaN; }
function lines(value: string) { return [...new Set(value.split("\n").map((item) => item.trim()).filter(Boolean))].slice(0, 15); }
async function campaignManager(campaignId: string, userId: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  if (campaign.organisationId) {
    const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: campaign.organisationId, userId } } });
    return membership && canManageProjects(membership.role) ? campaign : null;
  }
  return campaign.createdById === userId ? campaign : null;
}

export async function createCampaign(formData: FormData) {
  const user = await requireUser();
  if (!await platformFlag("CAMPAIGNS_ENABLED")) return;
  const input = z.object({ title: z.string().trim().min(4).max(140), brief: z.string().trim().min(30).max(4000), organisationId: z.string().min(1), platforms: z.string().max(500), contentTypes: z.string().max(500), usageRights: z.string().trim().max(2000).optional(), landingUrl: z.union([z.literal(""), z.url()]).optional(), startsAt: z.string().optional(), endsAt: z.string().optional(), currency: z.enum(currencies), fixedFee: z.string(), bonusRate: z.string(), bonusCap: z.string().optional(), bonusTerms: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const startsAt = input.data.startsAt ? new Date(`${input.data.startsAt}T12:00:00.000Z`) : null;
  const endsAt = input.data.endsAt ? new Date(`${input.data.endsAt}T12:00:00.000Z`) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt < startsAt)) return;
  const fixedFee = integer(formData.get("fixedFee")); const bonusRate = integer(formData.get("bonusRate")); const bonusCap = input.data.bonusCap?.trim() ? integer(input.data.bonusCap) : null;
  if (!Number.isSafeInteger(fixedFee) || !Number.isSafeInteger(bonusRate) || bonusRate > 10000 || (bonusCap !== null && !Number.isSafeInteger(bonusCap))) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: input.data.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return;
  const organisationId = membership.organisationId;
  const creatorIds = [...new Set(formData.getAll("creatorProfileIds").map(String))].slice(0, 50);
  const eligible = creatorIds.length ? await db.creatorProfile.findMany({ where: { id: { in: creatorIds }, isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, select: { id: true, userId: true } }) : [];
  if (eligible.length !== creatorIds.length) return;
  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.campaign.create({ data: { title: input.data.title, brief: input.data.brief, createdById: user.id, organisationId, platforms: lines(input.data.platforms), contentTypes: lines(input.data.contentTypes), usageRights: input.data.usageRights || null, landingUrl: input.data.landingUrl || null, startsAt, endsAt, currency: input.data.currency, status: creatorIds.length ? "INVITING" : "DRAFT" } });
    for (const creator of eligible) {
      await tx.campaignCreator.create({ data: { campaignId: created.id, creatorId: creator.id, fixedFee, bonusRate, bonusCap, bonusTerms: input.data.bonusTerms || null, contractTerms: `Campaign: ${created.title}\nUsage rights: ${input.data.usageRights || "As agreed in this campaign brief"}\nFixed compensation: ${input.data.currency} ${fixedFee}\nPerformance bonus: ${bonusRate} basis points${bonusCap === null ? " (no stated cap)" : `, capped at ${input.data.currency} ${bonusCap}`}\n${input.data.bonusTerms || ""}` } });
      await tx.notification.create({ data: { userId: creator.userId, title: "Creator campaign invitation", body: `You have been invited to review “${created.title}”. Review its terms before accepting.` } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_CREATED", entityType: "Campaign", entityId: created.id, metadata: { invitedCreators: eligible.length } } });
    return created;
  });
  revalidatePath("/workspace/campaigns");
  revalidatePath("/workspace/operations");
  redirect(`/workspace/campaigns?created=${campaign.id}`);
}

export async function inviteCampaignCreators(formData: FormData) {
  const user = await requireUser();
  if (!await platformFlag("CAMPAIGNS_ENABLED")) return;
  const input = z.object({ campaignId: z.string().min(1), fixedFee: z.string(), bonusRate: z.string(), bonusCap: z.string().optional(), bonusTerms: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const campaign = await campaignManager(input.data.campaignId, user.id);
  if (!campaign || !["DRAFT", "INVITING", "ACTIVE"].includes(campaign.status)) return;
  const fixedFee = integer(formData.get("fixedFee")); const bonusRate = integer(formData.get("bonusRate")); const bonusCap = input.data.bonusCap?.trim() ? integer(input.data.bonusCap) : null;
  if (!Number.isSafeInteger(fixedFee) || !Number.isSafeInteger(bonusRate) || bonusRate > 10000 || (bonusCap !== null && !Number.isSafeInteger(bonusCap))) return;
  const creatorIds = [...new Set(formData.getAll("creatorProfileIds").map(String))].slice(0, 50);
  if (!creatorIds.length) return;
  const existing = await db.campaignCreator.findMany({ where: { campaignId: campaign.id }, select: { creatorId: true } });
  const eligible = await db.creatorProfile.findMany({ where: { id: { in: creatorIds.filter((id) => !existing.some((item) => item.creatorId === id)) }, isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, select: { id: true, userId: true } });
  if (!eligible.length || eligible.length !== creatorIds.filter((id) => !existing.some((item) => item.creatorId === id)).length) return;
  await db.$transaction(async (tx) => {
    for (const creator of eligible) {
      await tx.campaignCreator.create({ data: { campaignId: campaign.id, creatorId: creator.id, fixedFee, bonusRate, bonusCap, bonusTerms: input.data.bonusTerms || null, contractTerms: `Campaign: ${campaign.title}\nUsage rights: ${campaign.usageRights || "As agreed in this campaign brief"}\nFixed compensation: ${campaign.currency} ${fixedFee}\nPerformance bonus: ${bonusRate} basis points${bonusCap === null ? " (no stated cap)" : `, capped at ${campaign.currency} ${bonusCap}`}\n${input.data.bonusTerms || ""}` } });
      await tx.notification.create({ data: { userId: creator.userId, title: "Creator campaign invitation", body: `You have been invited to review “${campaign.title}”. Review its terms before accepting.` } });
    }
    await tx.campaign.update({ where: { id: campaign.id }, data: { status: campaign.status === "DRAFT" ? "INVITING" : campaign.status } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_CREATORS_INVITED", entityType: "Campaign", entityId: campaign.id, metadata: { count: eligible.length } } });
  });
  revalidatePath("/workspace/campaigns");
}

export async function respondCampaignInvitation(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ campaignCreatorId: z.string().min(1), decision: z.enum(["ACCEPTED", "DECLINED"]) }).safeParse({ campaignCreatorId: formData.get("campaignCreatorId"), decision: formData.get("decision") });
  if (!parsed.success) return;
  const invitation = await db.campaignCreator.findUnique({ where: { id: parsed.data.campaignCreatorId }, include: { creator: { select: { userId: true } }, campaign: { select: { id: true, title: true, status: true } } } });
  if (!invitation || invitation.creator.userId !== user.id || invitation.status !== "INVITED" || !["INVITING", "ACTIVE"].includes(invitation.campaign.status)) return;
  await db.$transaction(async (tx) => {
    await tx.campaignCreator.update({ where: { id: invitation.id }, data: { status: parsed.data.decision, ...(parsed.data.decision === "ACCEPTED" ? { acceptedAt: new Date(), contractAcceptedAt: new Date() } : {}) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `CAMPAIGN_INVITATION_${parsed.data.decision}`, entityType: "CampaignCreator", entityId: invitation.id } });
    if (parsed.data.decision === "ACCEPTED") await tx.campaign.update({ where: { id: invitation.campaign.id }, data: { status: "ACTIVE" } });
  });
  revalidatePath("/workspace/campaigns");
}

export async function updateCampaignStatus(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ campaignId: z.string().min(1), status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]) }).safeParse({ campaignId: formData.get("campaignId"), status: formData.get("status") });
  if (!input.success) return;
  const campaign = await campaignManager(input.data.campaignId, user.id);
  if (!campaign) return;
  const allowed: Record<string, string[]> = { DRAFT: ["CANCELLED"], INVITING: ["ACTIVE", "PAUSED", "CANCELLED"], ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"], PAUSED: ["ACTIVE", "CANCELLED"] };
  if (!allowed[campaign.status]?.includes(input.data.status)) return;
  if (input.data.status === "COMPLETED") {
    const pendingContent = await db.campaignContent.count({ where: { campaignCreator: { campaignId: campaign.id }, status: { in: ["SUBMITTED", "REVISION_REQUESTED"] } } });
    const pendingAttributions = await db.campaignAttribution.count({ where: { campaignCreator: { campaignId: campaign.id }, status: "PENDING" } });
    if (pendingContent || pendingAttributions) return;
  }
  await db.$transaction(async (tx) => {
    await tx.campaign.update({ where: { id: campaign.id }, data: { status: input.data.status } });
    if (input.data.status === "COMPLETED") await tx.campaignCreator.updateMany({ where: { campaignId: campaign.id, status: { in: ["ACTIVE", "ACCEPTED"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (input.data.status === "CANCELLED") await tx.campaignCreator.updateMany({ where: { campaignId: campaign.id, status: { in: ["INVITED", "ACCEPTED", "ACTIVE"] } }, data: { status: "CANCELLED" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `CAMPAIGN_${input.data.status}`, entityType: "Campaign", entityId: campaign.id } });
  });
  revalidatePath("/workspace/campaigns");
  revalidatePath("/workspace/reports");
}

export async function submitCampaignContent(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ campaignCreatorId: z.string().min(1), title: z.string().trim().min(3).max(140), submissionUrl: z.union([z.literal(""), z.url()]).optional(), note: z.string().trim().min(10).max(2500) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const invitation = await db.campaignCreator.findUnique({ where: { id: input.data.campaignCreatorId }, include: { creator: { select: { userId: true } }, campaign: { select: { id: true, createdById: true, status: true } } } });
  if (!invitation || invitation.creator.userId !== user.id || !["ACCEPTED", "ACTIVE"].includes(invitation.status) || invitation.campaign.status !== "ACTIVE") return;
  const content = await db.campaignContent.create({ data: { campaignCreatorId: invitation.id, title: input.data.title, submissionUrl: input.data.submissionUrl || null, note: input.data.note } });
  await db.$transaction([
    db.notification.create({ data: { userId: invitation.campaign.createdById, title: "Campaign content submitted", body: `A creator submitted “${content.title}” for review.` } }),
    db.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_CONTENT_SUBMITTED", entityType: "CampaignContent", entityId: content.id } }),
  ]);
  revalidatePath("/workspace/campaigns");
}

export async function reviewCampaignContent(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ contentId: z.string().min(1), decision: z.enum(["APPROVED", "REVISION_REQUESTED", "REJECTED"]), reviewerNote: z.string().trim().min(4).max(1500) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const content = await db.campaignContent.findUnique({ where: { id: input.data.contentId }, include: { campaignCreator: { include: { campaign: true, creator: { select: { userId: true } } } } } });
  if (!content || !(await campaignManager(content.campaignCreator.campaignId, user.id)) || !["SUBMITTED", "REVISION_REQUESTED"].includes(content.status)) return;
  await db.$transaction(async (tx) => {
    await tx.campaignContent.update({ where: { id: content.id }, data: { status: input.data.decision, reviewerId: user.id, reviewerNote: input.data.reviewerNote, reviewedAt: new Date() } });
    await tx.notification.create({ data: { userId: content.campaignCreator.creator.userId, title: `Campaign content ${input.data.decision.toLowerCase().replaceAll("_", " ")}`, body: input.data.reviewerNote } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `CAMPAIGN_CONTENT_${input.data.decision}`, entityType: "CampaignContent", entityId: content.id } });
  });
  revalidatePath("/workspace/campaigns");
}

export async function recordPublishedContent(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ contentId: z.string().min(1), publishedUrl: z.url() }).safeParse({ contentId: formData.get("contentId"), publishedUrl: formData.get("publishedUrl") });
  if (!input.success) return;
  const content = await db.campaignContent.findUnique({ where: { id: input.data.contentId }, include: { campaignCreator: { include: { creator: { select: { userId: true } }, campaign: true } } } });
  if (!content || content.campaignCreator.creator.userId !== user.id || content.status !== "APPROVED") return;
  await db.$transaction(async (tx) => {
    await tx.campaignContent.update({ where: { id: content.id }, data: { status: "PUBLISHED", publishedUrl: input.data.publishedUrl, publishedAt: new Date() } });
    if (content.campaignCreator.fixedFee > 0) {
      const existing = await tx.compensationObligation.findUnique({ where: { campaignCreatorId: content.campaignCreatorId }, select: { id: true } });
      if (!existing) await tx.compensationObligation.create({ data: { reference: `CAMPAIGN-${content.campaignCreatorId}`, campaignCreatorId: content.campaignCreatorId, recipientId: content.campaignCreator.creator.userId, createdById: content.campaignCreator.campaign.createdById, amount: content.campaignCreator.fixedFee, currency: content.campaignCreator.campaign.currency, provider: "MOCK", simulated: true } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_CONTENT_PUBLISHED", entityType: "CampaignContent", entityId: content.id } });
  });
  revalidatePath("/workspace/campaigns");
}

export async function submitManualAttribution(formData: FormData) {
  const user = await requireUser();
  if (!await platformFlag("MANUAL_ATTRIBUTION_ENABLED")) return;
  const input = z.object({ campaignCreatorId: z.string().min(1), eventId: z.string().trim().min(3).max(100), orderReference: z.string().trim().max(120).optional(), amount: z.string(), currency: z.enum(currencies) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success || !validManualAttributionEventId(input.data.eventId)) return;
  const amount = integer(input.data.amount);
  if (!Number.isSafeInteger(amount)) return;
  const participation = await db.campaignCreator.findUnique({ where: { id: input.data.campaignCreatorId }, include: { creator: { select: { userId: true } }, campaign: { select: { id: true, currency: true } } } });
  if (!participation || participation.creator.userId !== user.id || !["ACCEPTED", "ACTIVE", "COMPLETED"].includes(participation.status) || input.data.currency !== participation.campaign.currency) return;
  try {
    const attribution = await db.campaignAttribution.create({ data: { campaignCreatorId: participation.id, sourceEventId: input.data.eventId, orderReference: input.data.orderReference || null, amount, currency: input.data.currency } });
    await db.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_TEST_ATTRIBUTION_SUBMITTED", entityType: "CampaignAttribution", entityId: attribution.id } });
  } catch { return; }
  revalidatePath("/workspace/campaigns");
}

export async function reviewManualAttribution(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ attributionId: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED"]), reviewerNote: z.string().trim().min(4).max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success || !["ADMIN", "OPERATIONS", "FINANCE"].includes(user.platformRole)) return;
  const attribution = await db.campaignAttribution.findUnique({ where: { id: input.data.attributionId }, include: { campaignCreator: { include: { campaign: true, creator: { select: { userId: true } } } } } });
  if (!attribution || attribution.status !== "PENDING") return;
  const reviewedAt = new Date();
  await db.$transaction(async (tx) => {
    let bonusAmount = 0;
    if (input.data.decision === "APPROVED") {
      const previous = await tx.campaignAttribution.aggregate({ where: { campaignCreatorId: attribution.campaignCreatorId, status: "APPROVED" }, _sum: { bonusAmount: true } });
      bonusAmount = calculateCreatorBonus(attribution.amount, attribution.campaignCreator.bonusRate, attribution.campaignCreator.bonusCap, previous._sum.bonusAmount ?? 0);
    }
    await tx.campaignAttribution.update({ where: { id: attribution.id }, data: { status: input.data.decision, reviewedAt, reviewerId: user.id, reviewerNote: input.data.reviewerNote, bonusAmount } });
    if (bonusAmount > 0 && input.data.decision === "APPROVED") await tx.compensationObligation.create({ data: { reference: `BONUS-${attribution.id}`, attributionId: attribution.id, recipientId: attribution.campaignCreator.creator.userId, createdById: attribution.campaignCreator.campaign.createdById, amount: bonusAmount, currency: attribution.currency, provider: "MOCK", simulated: true } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `CAMPAIGN_ATTRIBUTION_${input.data.decision}`, entityType: "CampaignAttribution", entityId: attribution.id, metadata: { bonusAmount } } });
  });
  revalidatePath("/workspace/campaigns");
  revalidatePath("/workspace/operations/campaigns");
}

export async function submitCampaignRating(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const input = z.object({ campaignCreatorId: z.string().min(1), rating: z.string(), comment: z.string().trim().max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Select a rating from one to five." };
  const rating = Number(input.data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Select a rating from one to five." };
  const participation = await db.campaignCreator.findUnique({ where: { id: input.data.campaignCreatorId }, include: { campaign: { select: { id: true, title: true, status: true, createdById: true } }, creator: { select: { userId: true } } } });
  if (!participation || participation.status !== "COMPLETED" || participation.campaign.status !== "COMPLETED") return { error: "Campaign ratings are available after the campaign is complete." };
  const isCreator = participation.creator.userId === user.id;
  const isManager = !isCreator && Boolean(await campaignManager(participation.campaignId, user.id));
  if (!isCreator && !isManager) return { error: "Only a campaign participant can submit this rating." };
  const revieweeId = isCreator ? participation.campaign.createdById : participation.creator.userId;
  if (revieweeId === user.id) return { error: "You cannot rate your own account." };
  try {
    const created = await db.campaignRating.create({ data: { campaignCreatorId: participation.id, reviewerId: user.id, revieweeId, rating, comment: input.data.comment || null } });
    await db.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_RATING_SUBMITTED", entityType: "CampaignRating", entityId: created.id, metadata: { rating, campaignId: participation.campaign.id } } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "You have already rated this completed campaign." };
    throw error;
  }
  revalidatePath("/workspace/campaigns");
  revalidatePath("/workspace/admin");
  revalidatePath("/workspace/admin/users");
  return { success: "Your campaign rating has been recorded." };
}
