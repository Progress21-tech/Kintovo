import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { privacyVersion, termsVersion } from "@/server/policies";
import { sessionFingerprint } from "@/server/session-fingerprint";

/**
 * The signed-in account for this request, or null. Wrapped in React `cache()` so the
 * layout, the page and any nested server components share one session decode and one
 * database read per request instead of repeating them.
 *
 * Returns null when the account is missing, disabled or banned, or when its password
 * changed after the session was issued (a reset signs out every other session).
 */
export const getSessionUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, platformRole: true, disabledAt: true, bannedAt: true, lastActiveAt: true, termsVersion: true, privacyVersion: true, passwordHash: true },
  });
  if (!user) return null;
  const { passwordHash, ...account } = user;
  const issuedFor = session.user.sessionFingerprint;
  // Sessions issued before fingerprints existed carry none; they expire within the 8-hour session lifetime.
  const revoked = Boolean(issuedFor && issuedFor !== sessionFingerprint(passwordHash));
  return { ...account, revoked, unavailable: Boolean(user.disabledAt || user.bannedAt) || revoked };
});

export const requireUser = cache(async () => {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.unavailable) redirect(user.revoked ? "/sign-in?notice=session-expired" : "/sign-in?notice=account-unavailable");
  if (user.termsVersion !== termsVersion || user.privacyVersion !== privacyVersion) redirect("/consent");
  const activeCutoff = new Date(Date.now() - 5 * 60 * 1000);
  if (!user.lastActiveAt || user.lastActiveAt < activeCutoff) {
    await db.user.updateMany({ where: { id: user.id, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: activeCutoff } }] }, data: { lastActiveAt: new Date() } });
  }
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, platformRole: user.platformRole, disabledAt: user.disabledAt, bannedAt: user.bannedAt, lastActiveAt: user.lastActiveAt, termsVersion: user.termsVersion, privacyVersion: user.privacyVersion };
});

export async function requireBusinessMembership(userId: string, organisationId: string) {
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId, userId } } });
  if (!membership) throw new Error("You do not have access to this organisation.");
  return membership;
}
