import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";

export async function getProjectAccess(projectId: string, userId: string) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, organisationId: true, status: true } });
  if (!project) return { project: null, membership: null, talentEngagement: null, canView: false, canManage: false };
  const [membership, talentEngagement] = await Promise.all([
    db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId } } }),
    db.engagement.findFirst({ where: { projectId, professional: { userId } }, select: { id: true, professionalProfileId: true, status: true } }),
  ]);
  // Professionals who delivered (or are delivering) the work keep access. An open
  // invitation only grants access while the project is still being matched; it must
  // not expose an active or finished team's workspace (or its private files) to
  // professionals who were merely invited, declined, or were cancelled.
  const delivering = Boolean(talentEngagement && ["ACTIVE", "COMPLETED", "DISPUTED"].includes(talentEngagement.status));
  const negotiating = Boolean(talentEngagement && ["INVITED", "PROPOSED", "NEGOTIATING", "AGREED"].includes(talentEngagement.status) && ["SUBMITTED", "IN_REVIEW", "MATCHING"].includes(project.status));
  const canView = Boolean(membership || delivering || negotiating);
  return { project, membership, talentEngagement, canView, canManage: Boolean(membership && canManageProjects(membership.role)) };
}
