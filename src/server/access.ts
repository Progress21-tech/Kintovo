import { auth } from "@/auth";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { privacyVersion, termsVersion } from "@/server/policies";
import { redirect } from "next/navigation";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, phone: true, platformRole: true, disabledAt: true, bannedAt: true, lastActiveAt: true, termsVersion: true, privacyVersion: true } });
  if (!user || user.disabledAt || user.bannedAt) redirect("/sign-in?notice=account-unavailable");
  if (user.termsVersion !== termsVersion || user.privacyVersion !== privacyVersion) redirect("/consent");
  const activeCutoff = new Date(Date.now() - 5 * 60 * 1000);
  if (!user.lastActiveAt || user.lastActiveAt < activeCutoff) {
    await db.user.updateMany({ where: { id: user.id, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: activeCutoff } }] }, data: { lastActiveAt: new Date() } });
  }
  return user;
}

export async function requireBusinessMembership(userId: string, organisationId: string) {
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId, userId } } });
  if (!membership) throw new Error("You do not have access to this organisation.");
  return membership;
}
