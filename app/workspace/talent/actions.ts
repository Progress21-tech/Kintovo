"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";

export async function shortlistTalent(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ projectId: z.string().min(1), profileId: z.string().min(1), note: z.string().trim().max(500).optional() }).safeParse({ projectId: formData.get("projectId"), profileId: formData.get("profileId"), note: formData.get("note") });
  if (!parsed.success) return { error: "Choose a project to save this candidate." };
  const profile = await db.professionalProfile.findFirst({ where: { id: parsed.data.profileId, isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, select: { id: true } });
  if (!profile) return { error: "This professional is no longer eligible for discovery." };
  const project = await db.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true, organisationId: true, status: true } });
  if (!project || project.status === "CANCELLED" || project.status === "COMPLETED") return { error: "Choose an active project brief." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership || !canManageProjects(membership.role)) return { error: "Your organisation role cannot manage this shortlist." };
  await db.$transaction([
    db.talentShortlist.upsert({ where: { projectId_professionalProfileId: { projectId: project.id, professionalProfileId: profile.id } }, create: { projectId: project.id, professionalProfileId: profile.id, createdById: user.id, note: parsed.data.note || null }, update: { note: parsed.data.note || null } }),
    db.auditLog.create({ data: { actorId: user.id, action: "TALENT_SHORTLISTED", entityType: "Project", entityId: project.id, metadata: { profileId: profile.id } } }),
  ]);
  revalidatePath(`/workspace/talent?projectId=${project.id}`);
  return { success: "Saved to the project shortlist." };
}
