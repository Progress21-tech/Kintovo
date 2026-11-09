import type { MembershipRole } from "@/generated/prisma/client";

export function canManageProjects(role: MembershipRole) {
  return role === "OWNER" || role === "ADMIN" || role === "PROJECT_MANAGER";
}

export function canApproveSpend(role: MembershipRole, separatelyAuthorised: boolean) {
  return role === "OWNER" || role === "ADMIN" || separatelyAuthorised;
}

export function canInviteOrganisationMembers(role: MembershipRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function canAssignOrganisationRole(actorRole: MembershipRole, invitedRole: MembershipRole) {
  if (!canInviteOrganisationMembers(actorRole)) return false;
  // Only owners may appoint another owner; an administrator cannot promote themselves.
  return invitedRole !== "OWNER" || actorRole === "OWNER";
}
