"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function resolveDispute(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const input = z.object({ disputeId: z.string().min(1), status: z.enum(["UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "ESCALATED", "CLOSED"]), resolution: z.string().trim().min(10).max(2000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const dispute = await db.dispute.findUnique({ where: { id: input.data.disputeId } });
  if (!dispute || ["RESOLVED", "CLOSED"].includes(dispute.status)) return;
  await db.$transaction([
    db.dispute.update({ where: { id: dispute.id }, data: { status: input.data.status, resolution: input.data.resolution } }),
    db.auditLog.create({ data: { actorId: user.id, action: `DISPUTE_${input.data.status}`, entityType: "Dispute", entityId: dispute.id } }),
  ]);
  revalidatePath("/workspace/operations/disputes");
  revalidatePath(`/workspace/projects/${dispute.projectId}`);
}
