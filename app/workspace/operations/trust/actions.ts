"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { notify, scheduleNotificationEmails } from "@/server/notifications";

function assertReviewer(role: string) {
  if (role !== "ADMIN" && role !== "OPERATIONS") redirect("/workspace");
}

export async function decideTrustReview(formData: FormData) {
  const user = await requireUser();
  assertReviewer(user.platformRole);
  const parsed = z.object({ id: z.string().min(1), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().min(4).max(1000) }).safeParse({ id: formData.get("id"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) return;
  const review = await db.trustReview.findUnique({ where: { id: parsed.data.id }, select: { id: true, status: true, dimension: true, professional: { select: { userId: true } }, creator: { select: { userId: true } } } });
  if (!review || !["SUBMITTED", "IN_REVIEW"].includes(review.status)) return;
  // Identity evidence is restricted: only platform Admins may open or decide it.
  if (review.dimension === "IDENTITY" && user.platformRole !== "ADMIN") return;
  const ownerId = review.professional?.userId ?? review.creator?.userId;
  await db.$transaction(async (tx) => {
    const changed = await tx.trustReview.updateMany({ where: { id: review.id, status: review.status }, data: { status: parsed.data.decision, reviewerId: user.id, reviewerNote: parsed.data.note, reviewedAt: new Date() } });
    if (!changed.count) return;
    await tx.auditLog.create({ data: { actorId: user.id, action: `TRUST_REVIEW_${parsed.data.decision}`, entityType: "TrustReview", entityId: review.id, metadata: { dimension: review.dimension } } });
    if (ownerId) await notify(tx, { userId: ownerId, category: "TRUST", title: `${review.dimension.replaceAll("_", " ").toLowerCase()} review ${parsed.data.decision.toLowerCase()}`, body: `${parsed.data.note}${parsed.data.decision === "REJECTED" ? " You can appeal this decision from Trust and evidence." : ""}`, href: "/workspace/profile/trust" });
  });
  scheduleNotificationEmails();
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/profile/trust");
}

export async function decideTrustAppeal(formData: FormData) {
  const user = await requireUser();
  assertReviewer(user.platformRole);
  const parsed = z.object({ appealId: z.string().min(1), decision: z.enum(["UNDER_REVIEW", "UPHELD", "REJECTED"]), note: z.string().trim().min(10).max(2000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const appeal = await db.trustAppeal.findUnique({ where: { id: parsed.data.appealId }, include: { trustReview: { select: { id: true, status: true, dimension: true } }, assessment: { select: { id: true, status: true } } } });
  if (!appeal || !["OPEN", "UNDER_REVIEW"].includes(appeal.status)) return;
  if (appeal.trustReview?.dimension === "IDENTITY" && user.platformRole !== "ADMIN") return;
  await db.$transaction(async (tx) => {
    const changed = await tx.trustAppeal.updateMany({ where: { id: appeal.id, status: appeal.status }, data: { status: parsed.data.decision, staffNote: parsed.data.note, reviewerId: user.id, reviewedAt: parsed.data.decision === "UNDER_REVIEW" ? null : new Date() } });
    if (!changed.count) return;
    // An upheld appeal reopens the rejected record for a fresh human decision; it never auto-approves.
    if (parsed.data.decision === "UPHELD" && appeal.kind === "APPEAL") {
      if (appeal.trustReview?.status === "REJECTED") await tx.trustReview.update({ where: { id: appeal.trustReview.id }, data: { status: "IN_REVIEW", reviewerNote: `Reopened on appeal: ${parsed.data.note}`.slice(0, 1000) } });
      if (appeal.assessment?.status === "REJECTED") await tx.skillsAssessment.update({ where: { id: appeal.assessment.id }, data: { status: "SUBMITTED", reviewerNote: `Reopened on appeal: ${parsed.data.note}`.slice(0, 1500) } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: `TRUST_APPEAL_${parsed.data.decision}`, entityType: "TrustAppeal", entityId: appeal.id, metadata: { kind: appeal.kind } } });
    await notify(tx, { userId: appeal.userId, category: "TRUST", title: `${appeal.kind === "APPEAL" ? "Appeal" : "Correction request"} ${parsed.data.decision.replaceAll("_", " ").toLowerCase()}`, body: parsed.data.note, href: "/workspace/profile/trust#appeals" });
  });
  scheduleNotificationEmails();
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/operations/assessments");
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
    db.professionalProfile.update({ where: { id: profile.id }, data: { isPublished: true } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PROFESSIONAL_PROFILE_PUBLISHED", entityType: "ProfessionalProfile", entityId: profile.id } }),
  ]);
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/talent");
}

export async function publishCreatorProfile(formData: FormData) {
  const user = await requireUser();
  assertReviewer(user.platformRole);
  const id = z.string().min(1).safeParse(formData.get("creatorProfileId"));
  if (!id.success) return;
  const profile = await db.creatorProfile.findUnique({ where: { id: id.data }, include: { trustReviews: { where: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } } });
  if (!profile?.onboardingCompletedAt || profile.trustReviews.length === 0) return;
  await db.$transaction([
    db.creatorProfile.update({ where: { id: profile.id }, data: { isPublished: true } }),
    db.auditLog.create({ data: { actorId: user.id, action: "CREATOR_PROFILE_PUBLISHED", entityType: "CreatorProfile", entityId: profile.id } }),
  ]);
  revalidatePath("/workspace/operations/trust");
  revalidatePath("/workspace/campaigns");
}
