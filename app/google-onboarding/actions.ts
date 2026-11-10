"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

const onboardingSchema = z.object({
  context: z.enum(["BUSINESS", "SPECIALIST", "CREATOR"]),
  organisation: z.string().trim().min(2).max(120).optional(),
  website: z.union([z.literal(""), z.url()]).optional(),
  industry: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  product: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
  biography: z.string().trim().max(3000).optional(),
  categories: z.string().max(1000).optional(),
  platforms: z.string().max(500).optional(),
});

function splitList(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

export async function completeGoogleOnboarding(_state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the onboarding details." };
  if (parsed.data.context === "BUSINESS" && !parsed.data.organisation) return { error: "Enter your organisation name." };
  const existing = await Promise.all([
    db.organisationMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (existing.some(Boolean)) redirect("/workspace");
  await db.$transaction(async (tx) => {
    if (parsed.data.context === "BUSINESS") {
      const organisation = await tx.organisation.create({ data: { name: parsed.data.organisation!, website: parsed.data.website || null, industry: parsed.data.industry || null, model: parsed.data.model || null, product: parsed.data.product || null, location: parsed.data.location || null } });
      await tx.organisationMembership.create({ data: { organisationId: organisation.id, userId: user.id, role: "OWNER" } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ORGANISATION_CREATED", entityType: "Organisation", entityId: organisation.id } });
    } else if (parsed.data.context === "SPECIALIST") {
      await tx.professionalProfile.create({ data: { userId: user.id, biography: parsed.data.biography || null, categories: splitList(parsed.data.categories), skills: [], languages: ["English"] } });
    } else {
      await tx.creatorProfile.create({ data: { userId: user.id, biography: parsed.data.biography || null, platforms: splitList(parsed.data.platforms), contentCategories: splitList(parsed.data.categories) } });
    }
    await tx.auditLog.create({ data: { actorId: user.id, action: "GOOGLE_ONBOARDING_COMPLETED", entityType: "User", entityId: user.id, metadata: { context: parsed.data.context } } });
  });
  redirect("/workspace");
}
