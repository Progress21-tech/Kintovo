import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";

export async function getProjectAccess(projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, organisationId: true, status: true } });
  if (!project) return { project: null, membership: null, talentEngagement: null, canView: false, canManage: false };
  const [membership, talentEngagement] = await Promise.all([
    db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId } } }),
    db.engagement.findFirst({ where: { projectId, professional: { userId } }, select: { id: true, professionalProfileId: true, status: true } }),
  ]);
  // An invitation grants access to its opportunity while matching, but it must
  // not expose an active team's workspace to other invited professionals.
  const canView = Boolean(membership || (talentEngagement && (project.status !== "ACTIVE" || talentEngagement.status === "ACTIVE")));
  return { project, membership, talentEngagement, canView, canManage: Boolean(membership && canManageProjects(membership.role)) };
}
