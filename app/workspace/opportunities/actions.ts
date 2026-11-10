"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function expressInterestInProject(formData: FormData) {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return;
  const profile = await db.professionalProfile.findFirst({ where: { userId: user.id, isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, select: { id: true } });
  if (!profile) return;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, title: true, status: true, createdById: true, organisationId: true } });
  if (!project || project.status !== "MATCHING") return;
  const [membership, existing] = await Promise.all([
    db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } }, select: { id: true } }),
    db.engagement.findUnique({ where: { projectId_professionalProfileId: { projectId: project.id, professionalProfileId: profile.id } }, select: { id: true } }),
  ]);
  if (membership || existing) return;
  const engagement = await db.$transaction(async (tx) => {
    const created = await tx.engagement.create({ data: { projectId: project.id, professionalProfileId: profile.id, createdById: user.id, status: "PROPOSED", message: "Specialist expressed interest through approved project discovery." } });
    await tx.notification.create({ data: { userId: project.createdById, title: "Specialist expressed interest", body: `A reviewed Specialist is interested in “${project.title}”. Open the project workspace to review their profile and proposal.` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "SPECIALIST_INTERESTED_IN_PROJECT", entityType: "Engagement", entityId: created.id, metadata: { projectId: project.id } } });
    return created;
  });
  revalidatePath("/workspace/opportunities");
  revalidatePath(`/workspace/projects/${project.id}`);
  return engagement.id;
}
