"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canApproveSpend, canManageProjects } from "@/server/permissions";
import { getProjectAccess } from "@/server/project-access";
import { canTransitionMilestone, canTransitionTask, type MilestoneState, type TaskState } from "@/server/workflow";

function refreshProject(id: string) { revalidatePath(`/workspace/projects/${id}`); }
function parsedDate(value: string | undefined) { if (!value?.trim()) return null; const date = new Date(`${value}T12:00:00.000Z`); return Number.isNaN(date.getTime()) ? undefined : date; }

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
      if (profile) await tx.notification.create({ data: { userId: profile.userId, title: "Task assigned", body: `A project task is assigned to you: ${created.title}.` } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_TASK_CREATED", entityType: "ProjectTask", entityId: created.id } });
    return created;
  });
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
  await db.$transaction([
    db.projectTask.update({ where: { id: task.id }, data: { status: input.data.status } }),
    db.auditLog.create({ data: { actorId: user.id, action: `PROJECT_TASK_${input.data.status}`, entityType: "ProjectTask", entityId: task.id } }),
  ]);
  refreshProject(task.projectId);
}

export async function addProjectMessage(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const input = z.object({ projectId: z.string().min(1), body: z.string().trim().min(1).max(3000), taskId: z.string().optional(), parentId: z.string().optional() }).safeParse(Object.fromEntries(formData.entries()));
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
  const message = await db.projectMessage.create({ data: { projectId: input.data.projectId, authorId: user.id, body: input.data.body, taskId: input.data.taskId || null, parentId: input.data.parentId || null } });
  await db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_MESSAGE_SENT", entityType: "ProjectMessage", entityId: message.id } });
  refreshProject(input.data.projectId);
  return { success: "Message sent to project participants." };
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

export async function submitMilestone(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const input = z.object({ milestoneId: z.string().min(1), note: z.string().trim().min(8).max(2000), evidenceUrl: z.union([z.literal(""), z.url()]).optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Add a clear submission note." };
  const milestone = await db.milestone.findUnique({ where: { id: input.data.milestoneId }, include: { project: { select: { id: true } }, assignedProfile: { select: { userId: true } } } });
  if (!milestone || milestone.assignedProfile?.userId !== user.id || !canTransitionMilestone(milestone.status as MilestoneState, "SUBMITTED")) return { error: "This milestone is not ready for your submission." };
  await db.$transaction(async (tx) => {
    await tx.submission.create({ data: { milestoneId: milestone.id, submittedById: user.id, note: input.data.note, evidenceUrl: input.data.evidenceUrl || null, revision: milestone.revisionCount } });
    await tx.milestone.update({ where: { id: milestone.id }, data: { status: "SUBMITTED" } });
    await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: milestone.status, toStatus: "SUBMITTED", note: input.data.note.slice(0, 500) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "MILESTONE_SUBMITTED", entityType: "Milestone", entityId: milestone.id } });
  });
  refreshProject(milestone.project.id);
  return { success: "Submission sent to the buyer for review." };
}

export async function reviewMilestone(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ milestoneId: z.string().min(1), decision: z.enum(["APPROVED", "REVISION_REQUESTED", "DISPUTED"]), note: z.string().trim().min(8).max(2000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const milestone = await db.milestone.findUnique({ where: { id: input.data.milestoneId }, include: { project: { select: { id: true, organisationId: true } }, assignedProfile: { select: { userId: true } } } });
  if (!milestone) return;
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: milestone.project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role) || !["SUBMITTED", "IN_REVIEW"].includes(milestone.status)) return;
  if (input.data.decision === "REVISION_REQUESTED" && milestone.revisionCount >= milestone.revisionAllowance) return;
  const nextStatus = input.data.decision;
  await db.$transaction(async (tx) => {
    if (milestone.status === "SUBMITTED") {
      await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: "SUBMITTED", toStatus: "IN_REVIEW", note: "Buyer review started." } });
      await tx.milestone.update({ where: { id: milestone.id }, data: { status: "IN_REVIEW" } });
    }
    await tx.milestone.update({ where: { id: milestone.id }, data: { status: nextStatus, ...(nextStatus === "REVISION_REQUESTED" ? { revisionCount: { increment: 1 } } : {}) } });
    await tx.milestoneEvent.create({ data: { milestoneId: milestone.id, actorId: user.id, fromStatus: "IN_REVIEW", toStatus: nextStatus, note: input.data.note } });
    if (nextStatus === "APPROVED" && milestone.amount > 0 && milestone.assignedProfile) {
      const existingObligation = await tx.compensationObligation.findUnique({ where: { milestoneId: milestone.id }, select: { id: true } });
      if (!existingObligation) await tx.compensationObligation.create({ data: { reference: `MILESTONE-${milestone.id}`, projectId: milestone.project.id, milestoneId: milestone.id, recipientId: milestone.assignedProfile.userId, createdById: user.id, amount: milestone.amount, currency: milestone.currency, provider: "MOCK", simulated: true } });
    }
    if (nextStatus === "DISPUTED") await tx.dispute.create({ data: { projectId: milestone.project.id, milestoneId: milestone.id, openedById: user.id, issueType: "DELIVERY_REVIEW", description: input.data.note, amountAffected: milestone.amount } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `MILESTONE_${nextStatus}`, entityType: "Milestone", entityId: milestone.id } });
    if (milestone.assignedProfile) await tx.notification.create({ data: { userId: milestone.assignedProfile.userId, title: `Milestone ${nextStatus.replaceAll("_", " ").toLowerCase()}`, body: input.data.note } });
  });
  refreshProject(milestone.project.id);
}

export async function openProjectDispute(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const input = z.object({ projectId: z.string().min(1), milestoneId: z.string().optional(), issueType: z.string().trim().min(3).max(100), description: z.string().trim().min(20).max(3000), amountAffected: z.string().optional() }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Describe the issue for the review record." };
  const access = await getProjectAccess(input.data.projectId, user.id);
  if (!access.canView || access.project?.status !== "ACTIVE") return { error: "You do not have access to this active project." };
  const amount = input.data.amountAffected?.trim() ? Number(input.data.amountAffected) : null;
  if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) return { error: "Enter a valid amount affected, or leave it blank." };
  if (input.data.milestoneId && !await db.milestone.findFirst({ where: { id: input.data.milestoneId, projectId: input.data.projectId } })) return { error: "That milestone does not belong to this project." };
  const dispute = await db.$transaction(async (tx) => {
    const created = await tx.dispute.create({ data: { projectId: input.data.projectId, milestoneId: input.data.milestoneId || null, openedById: user.id, issueType: input.data.issueType, description: input.data.description, amountAffected: amount } });
    if (input.data.milestoneId) {
      const milestone = await tx.milestone.findUnique({ where: { id: input.data.milestoneId }, select: { status: true } });
      if (milestone && milestone.status !== "APPROVED" && milestone.status !== "DISPUTED" && canTransitionMilestone(milestone.status as MilestoneState, "DISPUTED")) {
        await tx.milestone.update({ where: { id: input.data.milestoneId }, data: { status: "DISPUTED" } });
        await tx.milestoneEvent.create({ data: { milestoneId: input.data.milestoneId, actorId: user.id, fromStatus: milestone.status, toStatus: "DISPUTED", note: "A project dispute was opened." } });
      }
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "PROJECT_DISPUTE_OPENED", entityType: "Dispute", entityId: created.id } });
    return created;
  });
  refreshProject(dispute.projectId);
  return { success: "The dispute is recorded for operations review. This record does not guarantee recovery or release of funds." };
}

export async function createChangeRequest(_state: { error?: string; success?: string }, formData: FormData) {
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
  const change = await db.changeRequest.create({ data: { projectId: agreement.engagement.project.id, agreementId: agreement.id, createdById: user.id, reason: input.data.reason, proposedScope: input.data.proposedScope, proposedAmount: amount, proposedDeadline: deadline } });
  await db.auditLog.create({ data: { actorId: user.id, action: "AGREEMENT_CHANGE_REQUESTED", entityType: "ChangeRequest", entityId: change.id } });
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
    await tx.changeRequest.update({ where: { id: change.id }, data: { status: input.data.decision, responseNote: input.data.responseNote, respondedAt: now } });
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
      await tx.notification.create({ data: { userId: change.createdById, title: "Change request accepted", body: "The other party agreed to the proposed change. Both parties must now accept the new agreement version." } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: `AGREEMENT_CHANGE_${input.data.decision}`, entityType: "ChangeRequest", entityId: change.id } });
  });
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
  await db.$transaction([
    db.project.update({ where: { id: projectId.data }, data: { status: "COMPLETED" } }),
    db.engagement.updateMany({ where: { projectId: projectId.data, status: "ACTIVE" }, data: { status: "COMPLETED" } }),
    db.agreement.updateMany({ where: { engagement: { projectId: projectId.data }, status: "ACTIVE" }, data: { status: "COMPLETED" } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PROJECT_COMPLETED", entityType: "Project", entityId: projectId.data } }),
  ]);
  refreshProject(projectId.data);
}
