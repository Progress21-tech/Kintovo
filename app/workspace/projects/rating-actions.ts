"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function submitEngagementRating(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = z.object({ engagementId: z.string().min(1), rating: z.string(), comment: z.string().trim().max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Select a rating from one to five." };
  const rating = Number(parsed.data.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Select a rating from one to five." };
  const engagement = await db.engagement.findUnique({ where: { id: parsed.data.engagementId }, include: { project: { select: { id: true, status: true, createdById: true, organisationId: true } }, professional: { select: { userId: true } } } });
  if (!engagement || engagement.status !== "COMPLETED" || engagement.project.status !== "COMPLETED") return { error: "Ratings are available after the project and engagement are complete." };
  const isTalent = engagement.professional.userId === user.id;
  const membership = isTalent ? null : await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: engagement.project.organisationId, userId: user.id } }, select: { id: true } });
  if (!isTalent && !membership) return { error: "Only a project participant can submit this rating." };
  const revieweeId = isTalent ? engagement.project.createdById : engagement.professional.userId;
  if (revieweeId === user.id) return { error: "You cannot rate your own account." };
  try {
    const created = await db.engagementRating.create({ data: { engagementId: engagement.id, projectId: engagement.project.id, reviewerId: user.id, revieweeId, rating, comment: parsed.data.comment || null } });
    await db.auditLog.create({ data: { actorId: user.id, action: "ENGAGEMENT_RATING_SUBMITTED", entityType: "EngagementRating", entityId: created.id, metadata: { rating, projectId: engagement.project.id } } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "You have already rated this completed engagement." };
    throw error;
  }
  revalidatePath(`/workspace/projects/${engagement.project.id}`);
  revalidatePath("/workspace/admin");
  revalidatePath("/workspace/admin/users");
  revalidatePath("/workspace/talent");
  return { success: "Your project rating has been recorded." };
}
