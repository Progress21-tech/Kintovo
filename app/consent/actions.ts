"use server";

import { auth } from "@/auth";
import { db } from "@/server/db";
import { privacyVersion, termsVersion } from "@/server/policies";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function acceptCurrentPolicies(_state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const parsed = z.object({ acceptTerms: z.literal("on"), acceptPrivacy: z.literal("on") }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Accept both documents to continue." };
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, disabledAt: true, bannedAt: true } });
  if (!user || user.disabledAt || user.bannedAt) redirect("/sign-in?notice=account-unavailable");
  const acceptedAt = new Date();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { termsAcceptedAt: acceptedAt, termsVersion, privacyAcceptedAt: acceptedAt, privacyVersion } }),
    db.auditLog.create({ data: { actorId: user.id, action: "CURRENT_POLICIES_ACCEPTED", entityType: "User", entityId: user.id, metadata: { termsVersion, privacyVersion } } }),
  ]);
  const [membership, specialist, creator] = await Promise.all([
    db.organisationMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  redirect(membership || specialist || creator ? "/workspace" : "/google-onboarding");
}
