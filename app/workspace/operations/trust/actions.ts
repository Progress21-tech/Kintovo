"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

function assertReviewer(role: string) {
  if (role !== "ADMIN" && role !== "OPERATIONS") redirect("/workspace");
}

export async function decideTrustReview(formData: FormData) {
  const user = await requireUser();
  assertReviewer(user.platformRole);
  const parsed = z.object({ id: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().min(4).max(1000) }).safeParse({ id: formData.get("id"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) return;
  const review = await db.trustReview.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true, dimension: true } });
  if (!review || review.dimension === "IDENTITY" || !["SUBMITTED", "IN_REVIEW"].includes(review.status)) return;
  await db.$transaction([
    db.trustReview.update({ where: { id: review.id }, data: { status: parsed.data.decision, reviewerId: user.id, reviewerNote: parsed.data.note, reviewedAt: new Date() } }),
    db.auditLog.create({ data: { actorId: user.id, action: `TRUST_REVIEW_${parsed.data.decision}`, entityType: "TrustReview", entityId: review.id } }),
  ]);
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/profile/trust");
}

export async function publishProfessionalProfile(formData: FormData) {
  const user = await requireUser();
  assertReviewer(user.platformRole);
  const id = z.string().min(1).safeParse(formData.get("profileId"));
  if (!id.success) return;
  const profile = await db.professionalProfile.findUnique({ where: { id: id.data }, include: { trustReviews: { where: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } } });
  if (!profile?.onboardingCompletedAt || profile.trustReviews.length === 0) return;
  await db.$transaction([
    db.professionalProfile.update({ where: { id: profile.id }, data: { isPublished: true, verificationStatus: "VERIFIED" } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PROFESSIONAL_PROFILE_PUBLISHED", entityType: "ProfessionalProfile", entityId: profile.id } }),
  ]);
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/talent");
}
