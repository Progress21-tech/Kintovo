"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { privateStorage, storeUpload, isUploadError, validateUpload } from "@/server/storage";

type FormState = { error?: string; success?: string };
const MAX_ITEMS = 20;

function refresh() { revalidatePath("/workspace/profile"); revalidatePath("/workspace/talent"); revalidatePath("/workspace/professional"); }

export async function addPortfolioItem(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const fields = Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string"));
  const parsed = z.object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(100).optional(),
    occurredAt: z.string().optional(),
    url: z.union([z.literal(""), z.url()]).optional(),
    contribution: z.string().trim().min(10, "Describe your own contribution in at least 10 characters.").max(1000),
    skills: z.string().max(500).optional(),
    visibility: z.enum(["PRIVATE", "PUBLIC"]),
  }).safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the portfolio item." };
  const profile = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true, _count: { select: { portfolio: true } } } });
  if (!profile) return { error: "Save your specialist profile before adding portfolio items." };
  if (profile._count.portfolio >= MAX_ITEMS) return { error: `You can keep up to ${MAX_ITEMS} portfolio items.` };
  const occurredAt = parsed.data.occurredAt?.trim() ? new Date(`${parsed.data.occurredAt}-01T12:00:00.000Z`) : null;
  if (occurredAt && Number.isNaN(occurredAt.getTime())) return { error: "Enter the month the work was completed." };
  const file = formData.get("attachment");
  const hasFile = file && typeof file !== "string" && file.size > 0;
  if (!hasFile && !parsed.data.url) return { error: "Attach a work sample or add a link to it." };
  if (hasFile) {
    const check = validateUpload({ name: file.name, type: file.type, size: file.size, head: Buffer.from(await file.slice(0, 16).arrayBuffer()) });
    if (!check.ok) return { error: check.error };
  }
  const stored = hasFile ? await storeUpload(file, "PORTFOLIO") : null;
  if (stored && isUploadError(stored)) return { error: stored.error };
  await db.$transaction(async (tx) => {
    const item = await tx.portfolioItem.create({ data: {
      profileId: profile.id, title: parsed.data.title, description: parsed.data.description || null, category: parsed.data.category || null,
      occurredAt, url: parsed.data.url || null, contribution: parsed.data.contribution, isPublic: parsed.data.visibility === "PUBLIC",
      skills: [...new Set((parsed.data.skills ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 15),
    } });
    if (stored) await tx.fileAsset.create({ data: { ...stored, ownerId: user.id, purpose: "PORTFOLIO", portfolioItemId: item.id } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PORTFOLIO_ITEM_ADDED", entityType: "PortfolioItem", entityId: item.id, metadata: { file: Boolean(stored), public: item.isPublic } } });
  });
  refresh();
  return { success: "Portfolio item added. It is your claim until a reviewer assesses it through Trust and evidence." };
}

export async function setPortfolioVisibility(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ itemId: z.string().min(1), visibility: z.enum(["PRIVATE", "PUBLIC"]) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const changed = await db.portfolioItem.updateMany({ where: { id: parsed.data.itemId, profile: { userId: user.id } }, data: { isPublic: parsed.data.visibility === "PUBLIC" } });
  if (changed.count) await db.auditLog.create({ data: { actorId: user.id, action: `PORTFOLIO_ITEM_${parsed.data.visibility}`, entityType: "PortfolioItem", entityId: parsed.data.itemId } });
  refresh();
}

export async function deletePortfolioItem(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ itemId: z.string().min(1), confirm: z.literal("yes") }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const item = await db.portfolioItem.findFirst({ where: { id: parsed.data.itemId, profile: { userId: user.id } }, include: { files: { select: { storageKey: true } } } });
  if (!item) return;
  await db.$transaction([
    db.portfolioItem.delete({ where: { id: item.id } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PORTFOLIO_ITEM_DELETED", entityType: "PortfolioItem", entityId: item.id } }),
  ]);
  // Remove stored bytes after the records are gone; a failure here leaves only an orphaned private object.
  await Promise.all(item.files.map((file) => privateStorage().remove(file.storageKey).catch(() => undefined)));
  refresh();
}
