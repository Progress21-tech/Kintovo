"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { optionalHttpUrl } from "@/server/validation";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { notify, scheduleNotificationEmails } from "@/server/notifications";
import { isUploadError, storeUpload, validateUpload } from "@/server/storage";

type FormState = { error?: string; success?: string };

export async function requestTrustReview(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const parsed = z.object({
    profileType: z.enum(["SPECIALIST", "CREATOR"]),
    dimension: z.enum(["PORTFOLIO_SKILLS", "LOCAL_EXPERTISE", "IDENTITY"]),
    evidenceUrl: optionalHttpUrl().optional(),
    evidenceNote: z.string().trim().min(20).max(1500),
  }).safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Provide enough context for a human review." };
  const identity = parsed.data.dimension === "IDENTITY";
  const file = formData.get("attachment");
  const hasFile = file && typeof file !== "string" && file.size > 0;
  if (identity && !hasFile) return { error: "Identity verification needs a document upload. Links are not accepted for identity evidence." };
  if (identity && parsed.data.evidenceUrl) return { error: "Do not send identity documents as links. Upload the document instead." };
  if (hasFile) {
    const check = validateUpload({ name: file.name, type: file.type, size: file.size, head: Buffer.from(await file.slice(0, 16).arrayBuffer()) });
    if (!check.ok) return { error: check.error };
    if (identity && !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(check.contentType)) return { error: "Identity documents must be a PDF or an image." };
  }
  const isSpecialist = parsed.data.profileType === "SPECIALIST";
  const [specialist, creator] = await Promise.all([
    isSpecialist ? db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : Promise.resolve(null),
    !isSpecialist ? db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }) : Promise.resolve(null),
  ]);
  if (isSpecialist && !specialist || !isSpecialist && !creator) return { error: "Complete this profile before requesting a review." };
  const alreadyOpen = await db.trustReview.findFirst({ where: { dimension: parsed.data.dimension, status: { in: ["SUBMITTED", "IN_REVIEW"] }, ...(specialist ? { professionalProfileId: specialist.id } : { creatorProfileId: creator!.id }) } });
  if (alreadyOpen) return { error: "A request for this review dimension is already open." };
  const stored = hasFile ? await storeUpload(file, identity ? "IDENTITY_EVIDENCE" : "TRUST_EVIDENCE") : null;
  if (stored && isUploadError(stored)) return { error: stored.error };
  const review = await db.$transaction(async (tx) => {
    const created = await tx.trustReview.create({ data: {
      dimension: parsed.data.dimension,
      evidenceUrl: parsed.data.evidenceUrl || null,
      evidenceNote: parsed.data.evidenceNote,
      ...(specialist ? { professionalProfileId: specialist.id } : { creatorProfileId: creator!.id }),
    } });
    if (stored) await tx.fileAsset.create({ data: { ...stored, ownerId: user.id, purpose: identity ? "IDENTITY_EVIDENCE" : "TRUST_EVIDENCE", trustReviewId: created.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "TRUST_REVIEW_REQUESTED", entityType: "TrustReview", entityId: created.id, metadata: { dimension: created.dimension, file: Boolean(stored) } } });
    return created;
  });
  revalidatePath("/workspace/profile/trust");
  return { success: review.dimension === "IDENTITY" ? "Identity evidence submitted privately. Only a Kintovo Admin can open it, and every access is logged." : "Review request submitted. A human reviewer will record a separate decision for this evidence." };
}

/** Appeal a decision, or ask for correction of an inaccurate record. Always decided by a person. */
export async function submitTrustAppeal(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({
    kind: z.enum(["APPEAL", "CORRECTION"]),
    target: z.string().regex(/^(review|assessment):[A-Za-z0-9_-]+$/),
    reason: z.string().trim().min(30).max(3000),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Explain what is inaccurate or why the decision should be reconsidered." };
  const [type, id] = parsed.data.target.split(":");
  const ownsTarget = type === "review"
    ? await db.trustReview.findFirst({ where: { id, OR: [{ professional: { userId: user.id } }, { creator: { userId: user.id } }] }, select: { id: true, status: true } })
    : await db.skillsAssessment.findFirst({ where: { id, professional: { userId: user.id } }, select: { id: true, status: true } });
  if (!ownsTarget) return { error: "That record was not found on your profile." };
  if (parsed.data.kind === "APPEAL" && ownsTarget.status !== "REJECTED") return { error: "Only a rejected decision can be appealed. Use a correction request for other inaccuracies." };
  const open = await db.trustAppeal.findFirst({ where: { userId: user.id, status: { in: ["OPEN", "UNDER_REVIEW"] }, ...(type === "review" ? { trustReviewId: id } : { assessmentId: id }) } });
  if (open) return { error: "You already have an open request for this record." };
  const staff = await db.user.findMany({ where: { platformRole: { in: ["ADMIN", "OPERATIONS"] }, disabledAt: null, bannedAt: null }, select: { id: true }, take: 50 });
  await db.$transaction(async (tx) => {
    const appeal = await tx.trustAppeal.create({ data: { userId: user.id, kind: parsed.data.kind, reason: parsed.data.reason, ...(type === "review" ? { trustReviewId: id } : { assessmentId: id }) } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `TRUST_${parsed.data.kind}_SUBMITTED`, entityType: "TrustAppeal", entityId: appeal.id } });
    await notify(tx, staff.filter((item) => item.id !== user.id).map((item) => ({ userId: item.id, category: "TRUST" as const, title: parsed.data.kind === "APPEAL" ? "New trust appeal" : "New correction request", body: parsed.data.reason.slice(0, 200), href: "/workspace/operations/trust#appeals" })));
  });
  scheduleNotificationEmails();
  revalidatePath("/workspace/profile/trust");
  return { success: "Request submitted. A person on the Operations team will review it and reply here." };
}
