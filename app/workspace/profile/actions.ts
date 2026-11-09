"use server";

import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { z } from "zod";

const profileInput = z.object({
  context: z.enum(["SPECIALIST", "CREATOR"]),
  headline: z.string().trim().max(140).optional(),
  biography: z.string().trim().max(3000).optional(),
  city: z.string().trim().max(100).optional(),
  categories: z.string().max(1000).optional(),
  skills: z.string().max(1000).optional(),
  languages: z.string().max(500).optional(),
  availability: z.string().trim().max(160).optional(),
  rate: z.string().optional(),
  platforms: z.string().max(500).optional(),
});

function splitList(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

export async function saveProfile(_state: { error?: string; success?: string }, formData: FormData) {
  const user = await requireUser();
  const parsed = profileInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the profile details and try again." };
  const rate = parsed.data.rate?.trim() ? Number(parsed.data.rate) : undefined;
  if (rate !== undefined && (!Number.isSafeInteger(rate) || rate < 0)) return { error: "Enter a valid whole-number indicative rate." };
  if (parsed.data.context === "SPECIALIST") {
    await db.professionalProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, headline: parsed.data.headline || null, biography: parsed.data.biography || null, city: parsed.data.city || null, categories: splitList(parsed.data.categories), skills: splitList(parsed.data.skills), languages: splitList(parsed.data.languages), availability: parsed.data.availability || null, indicativeRate: rate ?? null },
      update: { headline: parsed.data.headline || null, biography: parsed.data.biography || null, city: parsed.data.city || null, categories: splitList(parsed.data.categories), skills: splitList(parsed.data.skills), languages: splitList(parsed.data.languages), availability: parsed.data.availability || null, indicativeRate: rate ?? null },
    });
  } else {
    await db.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, biography: parsed.data.biography || null, country: "Nigeria", platforms: splitList(parsed.data.platforms), contentCategories: splitList(parsed.data.categories) },
      update: { biography: parsed.data.biography || null, platforms: splitList(parsed.data.platforms), contentCategories: splitList(parsed.data.categories) },
    });
  }
  await db.auditLog.create({ data: { actorId: user.id, action: "PROFILE_UPDATED", entityType: parsed.data.context === "SPECIALIST" ? "ProfessionalProfile" : "CreatorProfile", entityId: user.id } });
  return { success: "Profile details saved. This profile is still private until the relevant review is complete." };
}
