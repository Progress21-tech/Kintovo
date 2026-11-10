"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function savePersonalSettings(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your contact details." };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PERSONAL_SETTINGS_UPDATED", entityType: "User", entityId: user.id } }),
  ]);
  revalidatePath("/workspace/settings");
  return { success: "Your personal contact details were saved." };
}

export async function saveOrganisationSettings(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({
    organisationId: z.string().min(1), name: z.string().trim().min(2).max(120),
    website: z.union([z.literal(""), z.url()]), industry: z.string().trim().max(120),
    model: z.string().trim().max(120), product: z.string().trim().max(300), location: z.string().trim().max(120),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the business details." };
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: parsed.data.organisationId, userId: user.id } } });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return { error: "Only an organisation owner or administrator can change business details." };
  await db.$transaction([
    db.organisation.update({ where: { id: membership.organisationId }, data: { name: parsed.data.name, website: parsed.data.website || null, industry: parsed.data.industry || null, model: parsed.data.model || null, product: parsed.data.product || null, location: parsed.data.location || null } }),
    db.auditLog.create({ data: { actorId: user.id, action: "ORGANISATION_SETTINGS_UPDATED", entityType: "Organisation", entityId: membership.organisationId } }),
  ]);
  revalidatePath("/workspace/settings");
  revalidatePath("/workspace");
  return { success: "Business workspace details were saved." };
}

export async function submitComplaint(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ subject: z.string().trim().min(5).max(140), category: z.enum(["ACCOUNT", "PAYMENTS", "PROJECT", "SAFETY", "OTHER"]), description: z.string().trim().min(20).max(4000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Add a subject and enough detail for the team to review." };
  const openCount = await db.complaint.count({ where: { userId: user.id, status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE"] } } });
  if (openCount >= 5) return { error: "You already have five complaints awaiting a response. Add your update to an existing complaint or wait for a reply." };
  const complaint = await db.complaint.create({ data: { userId: user.id, ...parsed.data } });
  await db.auditLog.create({ data: { actorId: user.id, action: "COMPLAINT_SUBMITTED", entityType: "Complaint", entityId: complaint.id } });
  revalidatePath("/workspace/settings");
  revalidatePath("/workspace/operations/complaints");
  return { success: "Your complaint has been sent to the platform operations team." };
}

export async function reviewComplaint(formData: FormData) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const parsed = z.object({ complaintId: z.string().min(1), status: z.enum(["UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED"]), staffNote: z.string().trim().min(5).max(2000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const complaint = await db.complaint.findUnique({ where: { id: parsed.data.complaintId }, select: { id: true, userId: true, status: true } });
  if (!complaint || ["RESOLVED", "CLOSED"].includes(complaint.status)) return;
  await db.$transaction([
    db.complaint.update({ where: { id: complaint.id }, data: { status: parsed.data.status, staffNote: parsed.data.staffNote, assignedToId: user.id } }),
    db.notification.create({ data: { userId: complaint.userId, title: `Complaint ${parsed.data.status.toLowerCase().replaceAll("_", " ")}`, body: parsed.data.staffNote } }),
    db.auditLog.create({ data: { actorId: user.id, action: `COMPLAINT_${parsed.data.status}`, entityType: "Complaint", entityId: complaint.id } }),
  ]);
  revalidatePath("/workspace/operations/complaints");
  revalidatePath("/workspace/settings");
}
