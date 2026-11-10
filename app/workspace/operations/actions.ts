"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

const settingKeys = ["CAMPAIGNS_ENABLED", "MANUAL_ATTRIBUTION_ENABLED", "NEW_PROJECTS_ENABLED"] as const;

export async function updatePlatformSetting(formData: FormData) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const parsed = z.object({ key: z.enum(settingKeys), enabled: z.enum(["true", "false"]) }).safeParse({ key: formData.get("key"), enabled: formData.get("enabled") });
  if (!parsed.success) return;
  await db.$transaction([
    db.platformSetting.upsert({ where: { key: parsed.data.key }, create: { key: parsed.data.key, value: parsed.data.enabled === "true", updatedById: user.id }, update: { value: parsed.data.enabled === "true", updatedById: user.id } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PLATFORM_SETTING_UPDATED", entityType: "PlatformSetting", entityId: parsed.data.key, metadata: { enabled: parsed.data.enabled === "true" } } }),
  ]);
  revalidatePath("/workspace/operations/settings");
  revalidatePath("/workspace/campaigns");
}

export async function saveRateCeiling(formData: FormData) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const parsed = z.object({ currency: z.enum(["NGN", "USD", "GBP", "EUR"]), level: z.enum(["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"]), amount: z.string() }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return;
  const amount = Number(parsed.data.amount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2_147_483_647) return;
  await db.$transaction([
    db.rateCeiling.upsert({ where: { currency_level: { currency: parsed.data.currency, level: parsed.data.level } }, create: { currency: parsed.data.currency, level: parsed.data.level, amount, updatedById: user.id }, update: { amount, updatedById: user.id } }),
    db.auditLog.create({ data: { actorId: user.id, action: "SPECIALIST_RATE_CEILING_UPDATED", entityType: "RateCeiling", entityId: `${parsed.data.currency}_${parsed.data.level}`, metadata: { amount } } }),
  ]);
  revalidatePath("/workspace/operations/settings");
  revalidatePath("/workspace/talent");
}

export async function reviewBrief(formData: FormData) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN" && user.platformRole !== "OPERATIONS") redirect("/workspace");
  const parsed = z.object({ projectId: z.string().min(1), decision: z.enum(["MATCH", "RETURN"]), note: z.string().trim().min(4).max(1000) }).safeParse({ projectId: formData.get("projectId"), decision: formData.get("decision"), note: formData.get("note") });
  if (!parsed.success) return;
  const project = await db.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true, status: true } });
  if (!project || !["SUBMITTED", "IN_REVIEW"].includes(project.status)) return;
  const status = parsed.data.decision === "MATCH" ? "MATCHING" : "DRAFT";
  await db.$transaction([
    db.project.update({ where: { id: project.id }, data: { status } }),
    db.projectReview.create({ data: { projectId: project.id, reviewerId: user.id, decision: parsed.data.decision, note: parsed.data.note } }),
    db.auditLog.create({ data: { actorId: user.id, action: `BRIEF_REVIEW_${parsed.data.decision}`, entityType: "Project", entityId: project.id } }),
  ]);
  revalidatePath("/workspace/operations/briefs");
  revalidatePath(`/workspace/projects/${project.id}`);
  redirect("/workspace/operations/briefs?reviewed=1");
}
