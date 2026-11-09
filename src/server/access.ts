import { auth } from "@/auth";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, platformRole: true, disabledAt: true } });
  if (!user || user.disabledAt) redirect("/sign-in?notice=account-unavailable");
  return user;
}

export async function requireBusinessMembership(userId: string, organisationId: string) {
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId, userId } } });
  if (!membership) throw new Error("You do not have access to this organisation.");
  return membership;
}
