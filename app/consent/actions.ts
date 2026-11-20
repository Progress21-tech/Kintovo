"use server";

import { getSessionUser } from "@/server/access";
import { db } from "@/server/db";
import { privacyVersion, termsVersion } from "@/server/policies";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function acceptCurrentPolicies(_state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/sign-in");
  const parsed = z.object({ acceptTerms: z.literal("on"), acceptPrivacy: z.literal("on") }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Accept both documents to continue." };
  const user = sessionUser;
  if (user.unavailable) redirect("/sign-in?notice=account-unavailable");
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
