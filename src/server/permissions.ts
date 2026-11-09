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
