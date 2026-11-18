"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { notify, scheduleNotificationEmails } from "@/server/notifications";
import { canTransitionDispute, type DisputeState } from "@/server/disputes";

async function partiesOf(projectId: string, milestoneId: string | null) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { organisationId: true } });
  if (!project) return [];
  const [members, talent] = await Promise.all([
    db.organisationMembership.findMany({ where: { organisationId: project.organisationId, role: { in: ["OWNER", "ADMIN", "PROJECT_MANAGER"] } }, select: { userId: true } }),
    milestoneId
      ? db.milestone.findUnique({ where: { id: milestoneId }, select: { assignedProfile: { select: { userId: true } } } }).then((item) => item?.assignedProfile ? [item.assignedProfile.userId] : [])
      : db.engagement.findMany({ where: { projectId, status: { in: ["ACTIVE", "DISPUTED", "COMPLETED"] } }, select: { professional: { select: { userId: true } } } }).then((rows) => rows.map((row) => row.professional.userId)),
  ]);
  return [...new Set([...members.map((item) => item.userId), ...talent])];
}

export async function resolveDispute(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const input = z.object({
    disputeId: z.string().min(1),
    status: z.enum(["AWAITING_EVIDENCE", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "ESCALATED", "CLOSED"]),
    resolution: z.string().trim().min(10).max(2000),
    visibility: z.enum(["PARTIES", "STAFF"]).default("PARTIES"),
    assignToMe: z.string().optional(),
    confirm: z.string().optional(),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const dispute = await db.dispute.findUnique({ where: { id: input.data.disputeId } });
  if (!dispute || !canTransitionDispute(dispute.status as DisputeState, input.data.status as DisputeState)) return;
  // Resolution and closure are consequential and require explicit confirmation.
  if (["RESOLVED", "CLOSED"].includes(input.data.status) && input.data.confirm !== "yes") return;
  const parties = await partiesOf(dispute.projectId, dispute.milestoneId);
  const outcome = ["RESOLVED", "CLOSED"].includes(input.data.status);
  await db.$transaction(async (tx) => {
    const changed = await tx.dispute.updateMany({ where: { id: dispute.id, status: dispute.status }, data: {
      status: input.data.status,
      ...(outcome ? { resolution: input.data.resolution } : {}),
      ...(input.data.assignToMe === "on" || !dispute.assignedReviewerId ? { assignedReviewerId: user.id } : {}),
    } });
    if (!changed.count) return;
    await tx.disputeNote.create({ data: { disputeId: dispute.id, authorId: user.id, body: `[${input.data.status.replaceAll("_", " ")}] ${input.data.resolution}`, visibility: outcome ? "PARTIES" : input.data.visibility } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `DISPUTE_${input.data.status}`, entityType: "Dispute", entityId: dispute.id, metadata: { from: dispute.status, visibility: input.data.visibility } } });
    if (outcome || input.data.visibility === "PARTIES") {
      await notify(tx, parties.map((userId) => ({ userId, category: "DISPUTE" as const, title: `Dispute update: ${input.data.status.replaceAll("_", " ").toLowerCase()}`, body: input.data.resolution, href: `/workspace/projects/${dispute.projectId}#disputes` })));
    }
  });
  scheduleNotificationEmails();
  revalidatePath("/workspace/operations/disputes");
  revalidatePath(`/workspace/projects/${dispute.projectId}`);
}
