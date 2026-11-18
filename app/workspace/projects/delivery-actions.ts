"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canApproveSpend, canManageProjects } from "@/server/permissions";
import { getProjectAccess } from "@/server/project-access";
import { canProposeSettlement, canRequestRevision, canTransitionMilestone, canTransitionTask, validateSettlementAmount, type MilestoneState, type TaskState } from "@/server/workflow";
import { transferApprovedMilestoneCompensation } from "@/server/paga-compensation";
import { notify, scheduleNotificationEmails, type NotifyInput } from "@/server/notifications";
import { isUploadError, storeUpload } from "@/server/storage";
import type { FileAssetPurpose } from "@/generated/prisma/client";

type FormState = { error?: string; success?: string };

function refreshProject(id: string) { revalidatePath(`/workspace/projects/${id}`); }
function parsedDate(value: string | undefined) { if (!value?.trim()) return null; const date = new Date(`${value}T12:00:00.000Z`); return Number.isNaN(date.getTime()) ? undefined : date; }

/** Everyone who should hear about project activity, excluding the actor. */
async function projectAudience(projectId: string, actorId: string, scope: "all" | "buyers" | "approvers" = "all") {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project) return [];
  const [members, talent] = await Promise.all([
    db.organisationMembership.findMany({ where: { organisationId: project.organisationId }, select: { userId: true, role: true, canApproveSpend: true } }),
    scope === "all" ? db.engagement.findMany({ where: { projectId, status: "ACTIVE" }, select: { professional: { select: { userId: true } } } }) : Promise.resolve([]),
  ]);
  const buyers = members.filter((item) => scope === "approvers" ? canApproveSpend(item.role, item.canApproveSpend) : canManageProjects(item.role) || canApproveSpend(item.role, item.canApproveSpend)).map((item) => item.userId);
  return [...new Set([...buyers, ...talent.map((item) => item.professional.userId)])].filter((id) => id !== actorId);
}

async function attachUpload(formData: FormData, userId: string, purpose: FileAssetPurpose, links: { projectId: string; submissionId?: string; messageId?: string; disputeId?: string }) {
  const stored = await storeUpload(formData.get("attachment"), purpose);
  if (!stored) return null;
  if (isUploadError(stored)) return stored;
  await db.fileAsset.create({ data: { ...stored, ownerId: userId, purpose, ...links } });
  return null;
}

/** Validates an optional upload before any record is written, so a bad file never leaves a half-saved action. */
async function precheckUpload(formData: FormData) {
  const file = formData.get("attachment");
  if (!file || typeof file === "string" || file.size === 0) return null;
  const { validateUpload } = await import("@/server/storage");
  const head = Buffer.from(await file.slice(0, 16).arrayBuffer());
  const check = validateUpload({ name: file.name, type: file.type, size: file.size, head });
  return check.ok ? null : check.error;
}

export async function createProjectTask(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ projectId: z.string().min(1), title: z.string().trim().min(3).max(140), description: z.string().trim().max(2000).optional(), assigneeProfileId: z.string().optional(), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), dueAt: z.string().optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const access = await getProjectAccess(input.data.projectId, user.id);
  if (!access.canManage || access.project?.status !== "ACTIVE") return;
  const dueAt = parsedDate(input.data.dueAt);
  if (dueAt === undefined) return;
  const assigneeId = input.data.assigneeProfileId || null;
  if (assigneeId) {
    const member = await db.engagement.findFirst({ where: { projectId: input.data.projectId, professionalProfileId: assigneeId, status: "ACTIVE" }, select: { id: true } });
    if (!member) return;
  }
  const task = await db.$transaction(async (tx) => {
    const created = await tx.projectTask.create({ data: { projectId: input.data.projectId, createdById: user.id, title: input.data.title, description: input.data.description || null, assigneeProfileId: assigneeId, priority: input.data.priority, dueAt } });
    if (assigneeId) {
      const profile = await tx.professionalProfile.findUnique({ where: { id: assigneeId }, select: { userId: true } });
      if (profile) await notify(tx, { userId: profile.userId, category: "TASK", title: "Task assigned", body: `A project task is assigned to you: ${created.title}.`, href: `/workspace/projects/${created.projectId}#task-${created.id}` });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_TASK_CREATED", entityType: "ProjectTask", entityId: created.id } });
    return created;
  });
  scheduleNotificationEmails();
  refreshProject(task.projectId);
}

export async function changeTaskStatus(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ taskId: z.string().min(1), status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "SUBMITTED", "APPROVED", "CANCELLED"]) }).safeParse({ taskId: formData.get("taskId"), status: formData.get("status") });
  if (!input.success) return;
  const task = await db.projectTask.findUnique({ where: { id: input.data.taskId }, include: { project: { select: { id: true } }, assignee: { select: { userId: true } } } });
  if (!task) return;
  const access = await getProjectAccess(task.projectId, user.id);
  const isAssignee = task.assignee?.userId === user.id;
  if (!access.canView || !canTransitionTask(task.status as TaskState, input.data.status as TaskState)) return;
  if (["APPROVED", "CANCELLED"].includes(input.data.status) ? !access.canManage : !isAssignee) return;
  const audience = input.data.status === "SUBMITTED" || input.data.status === "BLOCKED" ? await projectAudience(task.projectId, user.id, "buyers") : task.assignee && task.assignee.userId !== user.id ? [task.assignee.userId] : [];
  await db.$transaction(async (tx) => {
    // Optimistic guard: the status must still be the one we validated against.
    const changed = await tx.projectTask.updateMany({ where: { id: task.id, status: task.status }, data: { status: input.data.status } });
    if (!changed.count) return;
    await tx.auditLog.create({ data: { actorId: user.id, action: `PROJECT_TASK_${input.data.status}`, entityType: "ProjectTask", entityId: task.id, metadata: { from: task.status } } });
    await notify(tx, audience.map((userId) => ({ userId, category: "TASK" as const, title: `Task ${input.data.status.replaceAll("_", " ").toLowerCase()}`, body: task.title, href: `/workspace/projects/${task.projectId}#task-${task.id}` })));
  });
  scheduleNotificationEmails();
  refreshProject(task.projectId);
}

export async function addProjectMessage(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const input = z.object({ projectId: z.string().min(1), body: z.string().trim().min(1).max(3000), taskId: z.string().optional(), parentId: z.string().optional() }).safeParse(fields);
  if (!input.success) return { error: "Write a message of up to 3,000 characters." };
  const access = await getProjectAccess(input.data.projectId, user.id);
  if (!access.canView || access.project?.status !== "ACTIVE") return { error: "You do not have access to this active project." };
  if (input.data.taskId) {
    const task = await db.projectTask.findFirst({ where: { id: input.data.taskId, projectId: input.data.projectId }, select: { id: true } });
    if (!task) return { error: "That task does not belong to this project." };
  }
  if (input.data.parentId) {
    const parent = await db.projectMessage.findFirst({ where: { id: input.data.parentId, projectId: input.data.projectId }, select: { id: true } });
    if (!parent) return { error: "That message thread could not be found." };
  }
  const uploadError = await precheckUpload(formData);
  if (uploadError) return { error: uploadError };
  const audience = await projectAudience(input.data.projectId, user.id);
  const message = await db.$transaction(async (tx) => {
    const created = await tx.projectMessage.create({ data: { projectId: input.data.projectId, authorId: user.id, body: input.data.body, taskId: input.data.taskId || null, parentId: input.data.parentId || null } });
    await tx.auditLog.create({ data: { actorId: user.id, action: input.data.taskId ? "TASK_COMMENT_ADDED" : "PROJECT_MESSAGE_SENT", entityType: "ProjectMessage", entityId: created.id } });
    await notify(tx, audience.map((userId) => ({ userId, category: "MESSAGE" as const, title: input.data.taskId ? `${user.name} commented on a task` : `New project message from ${user.name}`, body: input.data.body.slice(0, 280), href: `/workspace/projects/${input.data.projectId}#messages` })));
    return created;
  });
  const failed = await attachUpload(formData, user.id, "PROJECT_MESSAGE", { projectId: input.data.projectId, messageId: message.id });
  scheduleNotificationEmails();
  refreshProject(input.data.projectId);
  return failed ? { error: `Message sent, but the attachment was not saved: ${failed.error}` } : { success: "Message sent to project participants." };
}

export async function startMilestone(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).safeParse(formData.get("milestoneId"));
  if (!id.success) return;
  const milestone = await db.milestone.findUnique({ where: { id: id.data }, include: { project: { select: { id: true } }, assignedProfile: { select: { userId: true } } } });
  if (!milestone || milestone.assignedProfile?.userId !== user.id || !canTransitionMilestone(milestone.status as MilestoneState, "IN_PROGRESS")) return;
  await db.$transaction([
    db.milestone.update({ where: { id: milestone.id }, data: { status: "IN_PROGRESS" } }),
    db.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: milestone.status, toStatus: "IN_PROGRESS" } }),
    db.auditLog.create({ data: { actorId: user.id, action: "MILESTONE_STARTED", entityType: "Milestone", entityId: milestone.id } }),
  ]);
  refreshProject(milestone.project.id);
}

export async function submitMilestone(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const input = z.object({ milestoneId: z.string().min(1), note: z.string().trim().min(8).max(2000), evidenceUrl: z.union([z.literal(""), z.url()]).optional() }).safeParse(fields);
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Add a clear submission note." };
  const milestone = await db.milestone.findUnique({ where: { id: input.data.milestoneId }, include: { project: { select: { id: true } }, assignedProfile: { select: { userId: true } } } });
  if (!milestone || milestone.assignedProfile?.userId !== user.id || !canTransitionMilestone(milestone.status as MilestoneState, "SUBMITTED")) return { error: "This milestone is not ready for your submission." };
  const uploadError = await precheckUpload(formData);
  if (uploadError) return { error: uploadError };
  const audience = await projectAudience(milestone.project.id, user.id, "buyers");
  const submission = await db.$transaction(async (tx) => {
    const created = await tx.submission.create({ data: { milestoneId: milestone.id, submittedById: user.id, note: input.data.note, evidenceUrl: input.data.evidenceUrl || null, revision: milestone.revisionCount } });
    await tx.milestone.update({ where: { id: milestone.id }, data: { status: "SUBMITTED" } });
    await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: milestone.status, toStatus: "SUBMITTED", note: input.data.note.slice(0, 500) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "MILESTONE_SUBMITTED", entityType: "Milestone", entityId: milestone.id } });
    await notify(tx, audience.map((userId) => ({ userId, category: "MILESTONE" as const, title: "Milestone submitted for review", body: `${user.name} submitted “${milestone.title}”. Review it within ${milestone.reviewWindowDays} days.`, href: `/workspace/projects/${milestone.project.id}#milestone-${milestone.id}` })));
    return created;
  });
  const failed = await attachUpload(formData, user.id, "MILESTONE_SUBMISSION", { projectId: milestone.project.id, submissionId: submission.id });
  scheduleNotificationEmails();
  refreshProject(milestone.project.id);
  return failed ? { error: `Submission recorded, but the file was not saved: ${failed.error}` } : { success: "Submission sent to the buyer for review." };
}

export async function reviewMilestone(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ milestoneId: z.string().min(1), decision: z.enum(["APPROVED", "REVISION_REQUESTED", "DISPUTED"]), note: z.string().trim().min(8).max(2000), criterion: z.string().trim().max(500).optional(), revisionDueAt: z.string().optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const milestone = await db.milestone.findUnique({ where: { id: input.data.milestoneId }, include: { project: { select: { id: true, organisationId: true } }, assignedProfile: { select: { userId: true } } } });
  if (!milestone) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: milestone.project.organisationId, userId: user.id } } });
  // Approving a milestone creates a payment obligation, so the reviewer needs spend authority,
  // not merely project-management rights.
  if (!membership || !canApproveSpend(membership.role, membership.canApproveSpend) || !["SUBMITTED", "IN_REVIEW"].includes(milestone.status)) return;
  if (input.data.decision === "REVISION_REQUESTED" && !canRequestRevision(milestone.revisionCount, milestone.revisionAllowance)) return;
  const revisionDueAt = parsedDate(input.data.revisionDueAt);
  if (revisionDueAt === undefined) return;
  const nextStatus = input.data.decision;
  const note = nextStatus === "REVISION_REQUESTED"
    ? `Revision ${milestone.revisionCount + 1} of ${milestone.revisionAllowance}. ${input.data.criterion ? `Acceptance criterion: ${input.data.criterion}. ` : ""}Requested changes: ${input.data.note}${revisionDueAt ? ` Revised delivery due ${revisionDueAt.toLocaleDateString("en-NG")}.` : ""}`
    : input.data.note;
  let pagaObligationId: string | null = null;
  const agreement = milestone.sourceAgreementId ? await db.agreement.findUnique({ where: { id: milestone.sourceAgreementId }, select: { id: true, version: true } }) : null;
  await db.$transaction(async (tx) => {
    const claimed = await tx.milestone.updateMany({ where: { id: milestone.id, status: milestone.status }, data: { status: "IN_REVIEW" } });
    if (!claimed.count) throw new Error("This milestone changed while you were reviewing it.");
    if (milestone.status === "SUBMITTED") await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: "SUBMITTED", toStatus: "IN_REVIEW", note: "Buyer review started." } });
    await tx.milestone.update({ where: { id: milestone.id }, data: { status: nextStatus, ...(nextStatus === "REVISION_REQUESTED" ? { revisionCount: { increment: 1 } } : {}) } });
    await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: "IN_REVIEW", toStatus: nextStatus, note: note.slice(0, 2000) } });
    if (nextStatus === "APPROVED" && milestone.amount > 0 && milestone.assignedProfile) {
      const existingObligation = await tx.compensationObligation.findUnique({ where: { milestoneId: milestone.id }, select: { id: true } });
      if (!existingObligation) {
        const obligation = await tx.compensationObligation.create({ data: { reference: `MILESTONE-${milestone.id}`, projectId: milestone.project.id, milestoneId: milestone.id, recipientId: milestone.assignedProfile.userId, createdById: user.id, amount: milestone.amount, currency: milestone.currency, provider: "PAGA", simulated: false } });
        await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "EARNED_ON_APPROVAL", amount: obligation.amount, currency: obligation.currency, simulated: false, providerEventId: `approval:${milestone.id}` } });
        pagaObligationId = obligation.id;
      }
    }
    if (nextStatus === "DISPUTED") await tx.dispute.create({ data: { projectId: milestone.project.id, milestoneId: milestone.id, openedById: user.id, issueType: "DELIVERY_REVIEW", description: input.data.note, amountAffected: milestone.amount, agreementId: agreement?.id ?? null, agreementVersion: agreement?.version ?? null } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `MILESTONE_${nextStatus}`, entityType: "Milestone", entityId: milestone.id } });
    if (milestone.assignedProfile) await notify(tx, { userId: milestone.assignedProfile.userId, category: nextStatus === "DISPUTED" ? "DISPUTE" : "MILESTONE", title: `Milestone ${nextStatus.replaceAll("_", " ").toLowerCase()}: ${milestone.title}`, body: note, href: `/workspace/projects/${milestone.project.id}#milestone-${milestone.id}` });
  });
  if (nextStatus === "APPROVED" && pagaObligationId) await transferApprovedMilestoneCompensation(pagaObligationId);
  scheduleNotificationEmails();
  revalidatePath("/workspace/earnings");
  revalidatePath("/workspace/funding");
  revalidatePath("/workspace/operations/finance");
  refreshProject(milestone.project.id);
}

export async function proposePartialSettlement(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = z.object({ milestoneId: z.string().min(1), amount: z.string().trim(), reason: z.string().trim().min(20).max(2000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Explain the proposed settlement." };
  const milestone = await db.milestone.findUnique({ where: { id: input.data.milestoneId }, include: { project: { select: { id: true, organisationId: true, status: true } }, assignedProfile: { select: { userId: true } }, settlementProposals: { where: { status: "PENDING" }, select: { id: true } } } });
  if (!milestone || milestone.project.status !== "ACTIVE" || !milestone.assignedProfile) return { error: "This milestone cannot be settled." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: milestone.project.organisationId, userId: user.id } } });
  if (!membership || !canApproveSpend(membership.role, membership.canApproveSpend)) return { error: "Only a member with spend authority can propose a settlement." };
  if (!canProposeSettlement(milestone.status as MilestoneState)) return { error: "Partial settlement is available for submitted, in-review, or disputed milestones." };
  if (milestone.settlementProposals.length) return { error: "A settlement proposal is already awaiting the professional's response." };
  const amount = Number(input.data.amount);
  const invalid = validateSettlementAmount(amount, milestone.amount);
  if (invalid) return { error: invalid };
  await db.$transaction(async (tx) => {
    const proposal = await tx.milestoneSettlementProposal.create({ data: { milestoneId: milestone.id, proposedById: user.id, amount, currency: milestone.currency, reason: input.data.reason } });
    await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: milestone.status, toStatus: milestone.status, note: `Partial settlement proposed: ${milestone.currency} ${amount.toLocaleString("en-NG")} of ${milestone.amount.toLocaleString("en-NG")}. ${input.data.reason}`.slice(0, 2000) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "MILESTONE_SETTLEMENT_PROPOSED", entityType: "MilestoneSettlementProposal", entityId: proposal.id, metadata: { amount, agreedAmount: milestone.amount } } });
    await notify(tx, { userId: milestone.assignedProfile!.userId, category: "MILESTONE", title: "Partial settlement proposed", body: `The buyer proposes ${milestone.currency} ${amount.toLocaleString("en-NG")} instead of ${milestone.amount.toLocaleString("en-NG")} for “${milestone.title}”. Nothing changes unless you accept.`, href: `/workspace/projects/${milestone.project.id}#milestone-${milestone.id}` });
  });
  scheduleNotificationEmails();
  refreshProject(milestone.project.id);
  return { success: "Settlement proposal sent. The agreed amount stands unless the professional accepts." };
}

export async function respondPartialSettlement(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ proposalId: z.string().min(1), decision: z.enum(["ACCEPTED", "REJECTED", "WITHDRAWN"]), responseNote: z.string().trim().max(1000).optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const proposal = await db.milestoneSettlementProposal.findUnique({ where: { id: input.data.proposalId }, include: { milestone: { include: { project: { select: { id: true } }, assignedProfile: { select: { userId: true } } } } } });
  if (!proposal || proposal.status !== "PENDING") return;
  const milestone = proposal.milestone;
  const isProfessional = milestone.assignedProfile?.userId === user.id;
  if (input.data.decision === "WITHDRAWN" ? proposal.proposedById !== user.id : !isProfessional) return;
  if (input.data.decision === "ACCEPTED" && !canProposeSettlement(milestone.status as MilestoneState)) return;
  let pagaObligationId: string | null = null;
  await db.$transaction(async (tx) => {
    const claimed = await tx.milestoneSettlementProposal.updateMany({ where: { id: proposal.id, status: "PENDING" }, data: { status: input.data.decision, respondedById: user.id, responseNote: input.data.responseNote || null, respondedAt: new Date() } });
    if (!claimed.count) return;
    if (input.data.decision === "ACCEPTED") {
      await tx.milestone.update({ where: { id: milestone.id }, data: { status: "APPROVED" } });
      await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: milestone.status, toStatus: "APPROVED", note: `Partial settlement accepted: ${proposal.currency} ${proposal.amount.toLocaleString("en-NG")} of the agreed ${milestone.amount.toLocaleString("en-NG")}.` } });
      if (!await tx.compensationObligation.findUnique({ where: { milestoneId: milestone.id }, select: { id: true } })) {
        const obligation = await tx.compensationObligation.create({ data: { reference: `MILESTONE-${milestone.id}`, projectId: milestone.project.id, milestoneId: milestone.id, recipientId: user.id, createdById: proposal.proposedById, amount: proposal.amount, currency: proposal.currency, provider: "PAGA", simulated: false } });
        await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "PARTIAL_SETTLEMENT", amount: proposal.amount, currency: proposal.currency, simulated: false, providerEventId: `settlement:${proposal.id}` } });
        pagaObligationId = obligation.id;
      }
      // A settlement agreed by both parties resolves disputes about this milestone.
      const open = await tx.dispute.findMany({ where: { milestoneId: milestone.id, status: { notIn: ["RESOLVED", "CLOSED"] } }, select: { id: true } });
      for (const dispute of open) {
        await tx.dispute.update({ where: { id: dispute.id }, data: { status: "RESOLVED", resolution: `Resolved by an accepted partial settlement of ${proposal.currency} ${proposal.amount.toLocaleString("en-NG")}.` } });
        await tx.auditLog.create({ data: { actorId: user.id, action: "DISPUTE_RESOLVED_BY_SETTLEMENT", entityType: "Dispute", entityId: dispute.id } });
      }
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: `MILESTONE_SETTLEMENT_${input.data.decision}`, entityType: "MilestoneSettlementProposal", entityId: proposal.id } });
    const recipient = input.data.decision === "WITHDRAWN" ? milestone.assignedProfile?.userId : proposal.proposedById;
    if (recipient) await notify(tx, { userId: recipient, category: "MILESTONE", title: `Partial settlement ${input.data.decision.toLowerCase()}`, body: `“${milestone.title}” · ${proposal.currency} ${proposal.amount.toLocaleString("en-NG")}${input.data.responseNote ? ` — ${input.data.responseNote}` : ""}`, href: `/workspace/projects/${milestone.project.id}#milestone-${milestone.id}` });
  });
  if (pagaObligationId) await transferApprovedMilestoneCompensation(pagaObligationId);
  scheduleNotificationEmails();
  revalidatePath("/workspace/earnings");
  refreshProject(milestone.project.id);
}

export async function openProjectDispute(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const input = z.object({ projectId: z.string().min(1), milestoneId: z.string().optional(), issueType: z.string().trim().min(3).max(100), description: z.string().trim().min(20).max(3000), amountAffected: z.string().optional() }).safeParse(fields);
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Describe the issue for the review record." };
  const access = await getProjectAccess(input.data.projectId, user.id);
  if (!access.canView || access.project?.status !== "ACTIVE") return { error: "You do not have access to this active project." };
  const amount = input.data.amountAffected?.trim() ? Number(input.data.amountAffected) : null;
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) return { error: "Enter a valid amount affected, or leave it blank." };
  const milestoneRecord = input.data.milestoneId ? await db.milestone.findFirst({ where: { id: input.data.milestoneId, projectId: input.data.projectId }, select: { id: true, sourceAgreementId: true } }) : null;
  if (input.data.milestoneId && !milestoneRecord) return { error: "That milestone does not belong to this project." };
  const uploadError = await precheckUpload(formData);
  if (uploadError) return { error: uploadError };
  // Record the agreement version in force so reviewers assess the terms that applied.
  const agreement = milestoneRecord?.sourceAgreementId
    ? await db.agreement.findUnique({ where: { id: milestoneRecord.sourceAgreementId }, select: { id: true, version: true } })
    : access.talentEngagement ? await db.agreement.findFirst({ where: { engagementId: access.talentEngagement.id, status: "ACTIVE" }, select: { id: true, version: true }, orderBy: { version: "desc" } }) : null;
  const audience = await projectAudience(input.data.projectId, user.id);
  const staff = await db.user.findMany({ where: { platformRole: { in: ["ADMIN", "OPERATIONS"] }, disabledAt: null, bannedAt: null }, select: { id: true }, take: 50 });
  const dispute = await db.$transaction(async (tx) => {
    const created = await tx.dispute.create({ data: { projectId: input.data.projectId, milestoneId: input.data.milestoneId || null, openedById: user.id, issueType: input.data.issueType, description: input.data.description, amountAffected: amount, agreementId: agreement?.id ?? null, agreementVersion: agreement?.version ?? null } });
    if (input.data.milestoneId) {
      const milestone = await tx.milestone.findUnique({ where: { id: input.data.milestoneId }, select: { status: true } });
      if (milestone && milestone.status !== "APPROVED" && milestone.status !== "DISPUTED" && canTransitionMilestone(milestone.status as MilestoneState, "DISPUTED")) {
        await tx.milestone.update({ where: { id: input.data.milestoneId }, data: { status: "DISPUTED" } });
        await tx.milestoneEvent.create({ data: { milestoneId: input.data.milestoneId, actorId: user.id, fromStatus: milestone.status, toStatus: "DISPUTED", note: "A project dispute was opened." } });
      }
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_DISPUTE_OPENED", entityType: "Dispute", entityId: created.id } });
    await notify(tx, [
      ...audience.map((userId) => ({ userId, category: "DISPUTE" as const, title: "A dispute was opened on your project", body: `${input.data.issueType}: ${input.data.description.slice(0, 240)}`, href: `/workspace/projects/${input.data.projectId}#disputes` })),
      ...staff.filter((item) => item.id !== user.id).map((item): NotifyInput => ({ userId: item.id, category: "DISPUTE", title: "New dispute awaiting review", body: input.data.issueType, href: "/workspace/operations/disputes" })),
    ]);
    return created;
  });
  const failed = await attachUpload(formData, user.id, "DISPUTE_EVIDENCE", { projectId: dispute.projectId, disputeId: dispute.id });
  scheduleNotificationEmails();
  refreshProject(dispute.projectId);
  return failed ? { error: `Dispute recorded, but the evidence file was not saved: ${failed.error}` } : { success: "The dispute is recorded for operations review. This record does not guarantee recovery or release of funds." };
}

export async function addDisputeEvidence(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const input = z.object({ disputeId: z.string().min(1), body: z.string().trim().min(4).max(3000) }).safeParse(fields);
  if (!input.success) return { error: "Describe the evidence or response." };
  const dispute = await db.dispute.findUnique({ where: { id: input.data.disputeId }, select: { id: true, projectId: true, status: true, assignedReviewerId: true } });
  if (!dispute || ["RESOLVED", "CLOSED"].includes(dispute.status)) return { error: "This dispute is closed." };
  const access = await getProjectAccess(dispute.projectId, user.id);
  if (!access.canView) return { error: "You do not have access to this dispute." };
  const uploadError = await precheckUpload(formData);
  if (uploadError) return { error: uploadError };
  const audience = await projectAudience(dispute.projectId, user.id);
  await db.$transaction(async (tx) => {
    const note = await tx.disputeNote.create({ data: { disputeId: dispute.id, authorId: user.id, body: input.data.body, visibility: "PARTIES" } });
    if (dispute.status === "AWAITING_EVIDENCE" || dispute.status === "AWAITING_RESPONSE") await tx.dispute.update({ where: { id: dispute.id }, data: { status: "UNDER_REVIEW" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "DISPUTE_EVIDENCE_ADDED", entityType: "Dispute", entityId: dispute.id, metadata: { noteId: note.id } } });
    await notify(tx, [...audience, ...(dispute.assignedReviewerId && dispute.assignedReviewerId !== user.id ? [dispute.assignedReviewerId] : [])].map((userId) => ({ userId, category: "DISPUTE" as const, title: "Dispute evidence added", body: input.data.body.slice(0, 240), href: `/workspace/projects/${dispute.projectId}#disputes` })));
  });
  const failed = await attachUpload(formData, user.id, "DISPUTE_EVIDENCE", { projectId: dispute.projectId, disputeId: dispute.id });
  scheduleNotificationEmails();
  refreshProject(dispute.projectId);
  revalidatePath("/workspace/operations/disputes");
  return failed ? { error: `Response recorded, but the file was not saved: ${failed.error}` } : { success: "Evidence added to the dispute record." };
}

export async function createChangeRequest(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = z.object({ agreementId: z.string().min(1), reason: z.string().trim().min(10).max(1000), proposedScope: z.string().trim().min(20).max(5000), proposedAmount: z.string().optional(), proposedDeadline: z.string().optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Describe the proposed scope change." };
  const agreement = await db.agreement.findUnique({ where: { id: input.data.agreementId }, include: { engagement: { include: { project: { select: { id: true, status: true, organisationId: true } }, professional: { select: { userId: true } } } } } });
  if (!agreement || agreement.status !== "ACTIVE" || agreement.engagement.project.status !== "ACTIVE") return { error: "Only an active agreement can be changed." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: agreement.engagement.project.organisationId, userId: user.id } } });
  const isTalent = agreement.engagement.professional.userId === user.id;
  if (membership ? !canManageProjects(membership.role) : !isTalent) return { error: "Only an authorised project lead or this agreement's professional can request a change." };
  const amount = input.data.proposedAmount?.trim() ? Number(input.data.proposedAmount) : null;
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) return { error: "Enter a valid proposed amount." };
  const deadline = parsedDate(input.data.proposedDeadline);
  if (deadline === undefined) return { error: "Enter a valid proposed date." };
  const audience = isTalent ? await projectAudience(agreement.engagement.project.id, user.id, "approvers") : [agreement.engagement.professional.userId];
  const change = await db.$transaction(async (tx) => {
    const created = await tx.changeRequest.create({ data: { projectId: agreement.engagement.project.id, agreementId: agreement.id, createdById: user.id, reason: input.data.reason, proposedScope: input.data.proposedScope, proposedAmount: amount, proposedDeadline: deadline } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "AGREEMENT_CHANGE_REQUESTED", entityType: "ChangeRequest", entityId: created.id } });
    await notify(tx, audience.map((userId) => ({ userId, category: "AGREEMENT" as const, title: "Agreement change requested", body: `${user.name}: ${input.data.reason}`, href: `/workspace/projects/${created.projectId}#changes` })));
    return created;
  });
  scheduleNotificationEmails();
  refreshProject(change.projectId);
  return { success: "Change request sent. The current agreement remains active until both parties accept an amendment." };
}

export async function respondToChangeRequest(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ changeRequestId: z.string().min(1), decision: z.enum(["ACCEPTED", "REJECTED"]), responseNote: z.string().trim().min(4).max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const change = await db.changeRequest.findUnique({
    where: { id: input.data.changeRequestId },
    include: { agreement: { include: {
      terms: true,
      engagement: { include: {
        project: { select: { id: true, organisationId: true } },
        professional: { select: { userId: true } },
      } },
    } } },
  });
  if (!change || change.status !== "PENDING" || change.createdById === user.id) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: change.agreement.engagement.project.organisationId, userId: user.id } } });
  const isTalent = change.agreement.engagement.professional.userId === user.id;
  if (membership ? !canApproveSpend(membership.role, membership.canApproveSpend) : !isTalent) return;
  const now = new Date();
  await db.$transaction(async (tx) => {
    const claimed = await tx.changeRequest.updateMany({ where: { id: change.id, status: "PENDING" }, data: { status: input.data.decision, responseNote: input.data.responseNote, respondedAt: now } });
    if (!claimed.count) return;
    if (input.data.decision === "ACCEPTED") {
      const versions = await tx.agreement.findMany({ where: { engagementId: change.agreement.engagementId }, select: { version: true } });
      const version = Math.max(...versions.map((item) => item.version)) + 1;
      await tx.agreement.create({ data: {
        engagementId: change.agreement.engagementId, version, status: "PENDING_ACCEPTANCE",
        terms: { create: {
          scope: change.proposedScope, deliverables: change.agreement.terms!.deliverables,
          amount: change.proposedAmount ?? change.agreement.terms!.amount, currency: change.agreement.terms!.currency,
          dueAt: change.proposedDeadline ?? change.agreement.terms!.dueAt, estimatedStartAt: change.agreement.terms!.estimatedStartAt,
          revisionAllowance: change.agreement.terms!.revisionAllowance, revisionTerms: change.agreement.terms!.revisionTerms,
          usageRights: change.agreement.terms!.usageRights, assumptions: change.agreement.terms!.assumptions,
          exclusions: change.agreement.terms!.exclusions, acceptanceCriteria: change.agreement.terms!.acceptanceCriteria,
          reviewWindowDays: change.agreement.terms!.reviewWindowDays,
        } },
      } });
    }
    await notify(tx, { userId: change.createdById, category: "AGREEMENT", title: `Change request ${input.data.decision.toLowerCase()}`, body: input.data.decision === "ACCEPTED" ? "The other party agreed to the proposed change. Both parties must now accept the new agreement version; the current version stays in force until then." : `The other party declined the change. ${input.data.responseNote}`, href: `/workspace/projects/${change.projectId}#changes` });
    await tx.auditLog.create({ data: { actorId: user.id, action: `AGREEMENT_CHANGE_${input.data.decision}`, entityType: "ChangeRequest", entityId: change.id } });
  });
  scheduleNotificationEmails();
  refreshProject(change.projectId);
}

export async function completeProject(formData: FormData) {
  const user = await requireUser();
  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) return;
  const access = await getProjectAccess(projectId.data, user.id);
  if (!access.canManage || access.project?.status !== "ACTIVE") return;
  const [milestones, disputes, changes] = await Promise.all([
    db.milestone.findMany({ where: { projectId: projectId.data }, select: { status: true } }),
    db.dispute.count({ where: { projectId: projectId.data, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.changeRequest.count({ where: { projectId: projectId.data, status: "PENDING" } }),
  ]);
  if (!milestones.length || milestones.some((item) => item.status !== "APPROVED") || disputes || changes) return;
  const audience = await projectAudience(projectId.data, user.id);
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId.data }, data: { status: "COMPLETED" } });
    await tx.engagement.updateMany({ where: { projectId: projectId.data, status: "ACTIVE" }, data: { status: "COMPLETED" } });
    await tx.agreement.updateMany({ where: { engagement: { projectId: projectId.data }, status: "ACTIVE" }, data: { status: "COMPLETED" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_COMPLETED", entityType: "Project", entityId: projectId.data } });
    await notify(tx, audience.map((userId) => ({ userId, category: "MILESTONE" as const, title: "Project completed", body: "All milestones are approved. You can now leave feedback for the engagement.", href: `/workspace/projects/${projectId.data}` })));
  });
  scheduleNotificationEmails();
  refreshProject(projectId.data);
}
