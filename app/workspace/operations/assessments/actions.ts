"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function createAssessment(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const input = z.object({ professionalProfileId: z.string().min(1), title: z.string().trim().min(4).max(140), category: z.string().trim().min(2).max(100), requiredSkills: z.string().trim().min(2).max(500), instructions: z.string().trim().min(20).max(2500) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const profile = await db.professionalProfile.findUnique({ where: { id: input.data.professionalProfileId }, select: { id: true, userId: true } });
  if (!profile) return;
  const assessment = await db.skillsAssessment.create({ data: { professionalProfileId: profile.id, title: input.data.title, category: input.data.category, requiredSkills: input.data.requiredSkills.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20), instructions: input.data.instructions } });
  await db.$transaction([
    db.notification.create({ data: { userId: profile.userId, title: "Practical assessment requested", body: `Complete “${assessment.title}” and submit a reviewable evidence link.` } }),
    db.auditLog.create({ data: { actorId: user.id, action: "SKILLS_ASSESSMENT_CREATED", entityType: "SkillsAssessment", entityId: assessment.id } }),
  ]);
  revalidatePath("/workspace/operations/assessments");
}

export async function reviewAssessment(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const input = z.object({ assessmentId: z.string().min(1), status: z.enum(["APPROVED", "REJECTED"]), score: z.string(), reviewerNote: z.string().trim().min(4).max(1500) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const score = Number(input.data.score);
  if (!Number.isInteger(score) || score < 0 || score > 100) return;
  const assessment = await db.skillsAssessment.findUnique({ where: { id: input.data.assessmentId }, include: { professional: { select: { userId: true } } } });
  if (!assessment || assessment.status !== "SUBMITTED") return;
  await db.$transaction(async (tx) => {
    await tx.skillsAssessment.update({ where: { id: assessment.id }, data: { status: input.data.status, score, reviewerId: user.id, reviewerNote: input.data.reviewerNote, reviewedAt: new Date() } });
    await tx.notification.create({ data: { userId: assessment.professional.userId, title: `Assessment ${input.data.status.toLowerCase()}`, body: `${input.data.reviewerNote} Score: ${score}/100.` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: `SKILLS_ASSESSMENT_${input.data.status}`, entityType: "SkillsAssessment", entityId: assessment.id, metadata: { score } } });
  });
  revalidatePath("/workspace/operations/assessments");
  revalidatePath("/workspace/profile/assessments");
}

export async function submitAssessment(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ assessmentId: z.string().min(1), submittedEvidenceUrl: z.url() }).safeParse({ assessmentId: formData.get("assessmentId"), submittedEvidenceUrl: formData.get("submittedEvidenceUrl") });
  if (!input.success) return;
  const assessment = await db.skillsAssessment.findUnique({ where: { id: input.data.assessmentId }, include: { professional: { select: { userId: true } } } });
  if (!assessment || assessment.professional.userId !== user.id || assessment.status !== "NOT_STARTED") return;
  await db.$transaction([
    db.skillsAssessment.update({ where: { id: assessment.id }, data: { status: "SUBMITTED", submittedEvidenceUrl: input.data.submittedEvidenceUrl, submittedAt: new Date() } }),
    db.auditLog.create({ data: { actorId: user.id, action: "SKILLS_ASSESSMENT_SUBMITTED", entityType: "SkillsAssessment", entityId: assessment.id } }),
  ]);
  revalidatePath("/workspace/profile/assessments");
  revalidatePath("/workspace/operations/assessments");
}
