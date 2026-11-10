"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function requestTrustReview(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = z.object({
    profileType: z.enum(["SPECIALIST", "CREATOR"]),
    dimension: z.enum(["PORTFOLIO_SKILLS", "LOCAL_EXPERTISE"]),
    evidenceUrl: z.union([z.literal(""), z.url()]).optional(),
    evidenceNote: z.string().trim().min(20).max(1500),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provide enough context for a human review." };
  const isSpecialist = parsed.data.profileType === "SPECIALIST";
  const [specialist, creator] = await Promise.all([
    isSpecialist ? db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : Promise.resolve(null),
    !isSpecialist ? db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (isSpecialist && !specialist || !isSpecialist && !creator) return { error: "Complete this profile before requesting a review." };
  const alreadyOpen = await db.trustReview.findFirst({ where: { dimension: parsed.data.dimension, status: { in: ["SUBMITTED", "IN_REVIEW"] }, ...(specialist ? { professionalProfileId: specialist.id } : { creatorProfileId: creator!.id }) } });
  if (alreadyOpen) return { error: "A request for this review dimension is already open." };
  const review = await db.trustReview.create({ data: {
    dimension: parsed.data.dimension,
    evidenceUrl: parsed.data.evidenceUrl || null,
    evidenceNote: parsed.data.evidenceNote,
    ...(specialist ? { professionalProfileId: specialist.id } : { creatorProfileId: creator!.id }),
  } });
  await db.auditLog.create({ data: { actorId: user.id, action: "TRUST_REVIEW_REQUESTED", entityType: "TrustReview", entityId: review.id, metadata: { dimension: review.dimension } } });
  revalidatePath("/workspace/profile/trust");
  return { success: "Review request submitted. A human reviewer will record a separate decision for this evidence." };
}
