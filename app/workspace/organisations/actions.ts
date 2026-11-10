"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canAssignOrganisationRole, canInviteOrganisationMembers } from "@/server/permissions";
import { sendAccountEmail } from "@/server/email";

const organisationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website: z.union([z.literal(""), z.url()]).optional(),
  industry: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  product: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
});

export async function createOrganisation(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = organisationSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the organisation details." };
  const organisation = await db.$transaction(async (tx) => {
    const created = await tx.organisation.create({ data: {
      name: parsed.data.name,
      website: parsed.data.website || null,
      industry: parsed.data.industry || null,
      model: parsed.data.model || null,
      product: parsed.data.product || null,
      location: parsed.data.location || null,
    } });
    await tx.organisationMembership.create({ data: { organisationId: created.id, userId: user.id, role: "OWNER" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ORGANISATION_CREATED", entityType: "Organisation", entityId: created.id } });
    return created;
  });
  revalidatePath("/workspace");
  redirect(`/workspace/organisations?created=${organisation.id}`);
}

const invitationSchema = z.object({
  organisationId: z.string().min(1),
  email: z.email().trim().toLowerCase(),
  role: z.enum(["OWNER", "ADMIN", "PROJECT_MANAGER", "MEMBER"]),
  canApproveSpend: z.enum(["true", "false"]).default("false"),
});

export async function inviteOrganisationMember(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = invitationSchema.safeParse({
    organisationId: formData.get("organisationId"),
    email: formData.get("email"),
    role: formData.get("role"),
    canApproveSpend: formData.get("canApproveSpend") ?? "false",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation details." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: parsed.data.organisationId, userId: user.id } } });
  if (!membership || !canAssignOrganisationRole(membership.role, parsed.data.role)) return { error: "Only an authorised organisation owner or administrator can invite this role." };
  if (parsed.data.canApproveSpend === "true" && membership.role !== "OWNER" && membership.role !== "ADMIN") return { error: "Only an owner or administrator can grant financial approval authority." };
  const [organisation, invitedUser, existing] = await Promise.all([
    db.organisation.findUnique({ where: { id: parsed.data.organisationId }, select: { name: true } }),
    db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
    db.organisationInvitation.findFirst({ where: { organisationId: parsed.data.organisationId, email: parsed.data.email, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  if (!organisation) return { error: "Organisation not found." };
  if (invitedUser && await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: parsed.data.organisationId, userId: invitedUser.id } } })) return { error: "That person is already a member of this organisation." };

  const rawToken = randomBytes(32).toString("hex");
  const token = createHash("sha256").update(rawToken).digest("hex");
  await db.$transaction(async (tx) => {
    if (existing) await tx.organisationInvitation.delete({ where: { id: existing.id } });
    await tx.organisationInvitation.create({ data: {
      organisationId: parsed.data.organisationId,
      email: parsed.data.email,
      role: parsed.data.role,
      canApproveSpend: parsed.data.canApproveSpend === "true",
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ORGANISATION_INVITATION_SENT", entityType: "Organisation", entityId: parsed.data.organisationId, metadata: { email: parsed.data.email, role: parsed.data.role } } });
  });
  const url = `${process.env.AUTH_URL ?? "http://localhost:3000"}/invitations/accept?token=${rawToken}`;
  try {
    await sendAccountEmail(parsed.data.email, `Invitation to join ${organisation.name} on Kintovo`, url);
  } catch {
    return { error: "The invitation was saved but could not be emailed. Check SMTP settings, then send a new invitation." };
  }
  revalidatePath("/workspace/organisations");
  return { success: `Invitation sent to ${parsed.data.email}. It expires in 7 days.` };
}

export async function acceptOrganisationInvitation(formData: FormData) {
  const user = await requireUser();
  const rawToken = z.string().min(40).max(100).safeParse(formData.get("token"));
  if (!rawToken.success) redirect("/workspace/organisations?invite=invalid");
  const token = createHash("sha256").update(rawToken.data).digest("hex");
  const invitation = await db.organisationInvitation.findUnique({ where: { token }, include: { organisation: { select: { name: true } } } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) redirect("/workspace/organisations?invite=expired");
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) redirect("/workspace/organisations?invite=email-mismatch");
  const existingMembership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: invitation.organisationId, userId: user.id } } });
  if (existingMembership) redirect("/workspace/organisations?invite=already-member");
  await db.$transaction(async (tx) => {
    await tx.organisationMembership.create({
      data: { organisationId: invitation.organisationId, userId: user.id, role: invitation.role, canApproveSpend: invitation.canApproveSpend },
    });
    await tx.organisationInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "ORGANISATION_INVITATION_ACCEPTED", entityType: "Organisation", entityId: invitation.organisationId, metadata: { role: invitation.role } } });
  });
  revalidatePath("/workspace");
  redirect("/workspace/organisations?invite=accepted");
}
