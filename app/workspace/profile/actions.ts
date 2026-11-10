"use server";

import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { enhanceSpecialistProfile, isScopeAiConfigured } from "@/server/scope-service";
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
  availabilityStatus: z.enum(["AVAILABLE", "AVAILABLE_FROM", "UNAVAILABLE", "UNSET"]).optional(),
  availableFrom: z.string().optional(),
  preferredDuration: z.string().trim().max(120).optional(),
  preferredArrangement: z.string().trim().max(120).optional(),
  preferredEngagements: z.string().max(300).optional(),
  rate: z.string().optional(),
  platforms: z.string().max(500).optional(),
  yearsExperience: z.string().optional(),
  marketExperience: z.string().trim().max(1000).optional(),
  audienceSize: z.string().optional(),
  audienceGeography: z.string().trim().max(500).optional(),
  audienceEvidence: z.string().trim().max(1500).optional(),
  portfolio: z.string().max(5000).optional(),
  intent: z.enum(["SAVE", "SUBMIT"]).default("SAVE"),
});

function splitList(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

const profileEnhancementInput = z.object({
  consent: z.literal(true),
  headline: z.string().trim().max(140).optional(),
  biography: z.string().trim().max(3000).optional(),
  categories: z.string().trim().max(1000).optional(),
  skills: z.string().trim().max(1000).optional(),
  marketExperience: z.string().trim().max(1000).optional(),
});

export async function suggestSpecialistProfile(rawInput: unknown) {
  const user = await requireUser();
  const parsed = profileEnhancementInput.safeParse(rawInput);
  if (!parsed.success) return { error: "Review your profile details and confirm consent before requesting suggestions." } as const;
  const [existingSpecialist, existingCreator, businessMembership] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.organisationMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (existingCreator && !existingSpecialist) return { error: "AI profile suggestions are available for specialist profiles." } as const;
  if (!existingSpecialist && businessMembership) return { error: "Business accounts cannot request specialist profile suggestions." } as const;
  const { consent: _consent, ...draft } = parsed.data;
  if (!Object.values(draft).some((value) => value?.trim())) return { error: "Add a headline, description, categories, skills, or market experience first." } as const;
  if (!isScopeAiConfigured()) return { error: "AI profile suggestions are not connected. The platform administrator needs to configure the AI provider." } as const;
  const result = await enhanceSpecialistProfile(draft);
  if ("error" in result) {
    const messages = {
      not_configured: "AI profile suggestions are not configured. Ask the platform administrator to check the AI settings.",
      authentication_failed: "The AI provider rejected its API key. Ask the platform administrator to check AI_API_KEY in Vercel.",
      rate_limited: "The AI provider's free-tier quota has been reached. Try again later.",
      invalid_request: "The AI provider rejected the request. Ask the platform administrator to check the model settings.",
      invalid_response: "The AI provider returned an unreadable profile suggestion. Try again.",
      provider_unavailable: "The AI provider is temporarily unavailable. Try again shortly.",
      timeout: "The AI provider took too long to respond. Try again with a shorter profile draft.",
      provider_failed: "The AI provider could not be reached. Try again shortly.",
    };
    return { error: messages[result.error] } as const;
  }
  return { suggestion: result.suggestion } as const;
}

export async function saveProfile(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = profileInput.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the profile details and try again." };
  const [existingSpecialist, existingCreator, businessMembership] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.organisationMembership.findFirst({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (existingSpecialist && parsed.data.context !== "SPECIALIST") return { error: "This account is restricted to the specialist profile." };
  if (existingCreator && parsed.data.context !== "CREATOR") return { error: "This account is restricted to the creator profile." };
  if (!existingSpecialist && !existingCreator && businessMembership) return { error: "Business accounts complete onboarding through their organisation and project goal flow." };
  const rate = parsed.data.rate?.trim() ? Number(parsed.data.rate) : undefined;
  if (rate !== undefined && (!Number.isSafeInteger(rate) || rate < 0)) return { error: "Enter a valid whole-number indicative rate." };
  const yearsExperience = parsed.data.yearsExperience?.trim() ? Number(parsed.data.yearsExperience) : undefined;
  if (yearsExperience !== undefined && (!Number.isSafeInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) return { error: "Enter years of experience as a whole number from 0 to 80." };
  const audienceSize = parsed.data.audienceSize?.trim() ? Number(parsed.data.audienceSize) : undefined;
  if (audienceSize !== undefined && (!Number.isSafeInteger(audienceSize) || audienceSize < 0)) return { error: "Enter a valid whole-number audience size." };
  const portfolioItems = (parsed.data.portfolio ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (portfolioItems.length > 10) return { error: "Add up to 10 portfolio items." };
  const portfolio = portfolioItems.map((line) => {
    const [title, url, contribution = "", visibility = ""] = line.split("|").map((part) => part.trim());
    if (!title || (url && !z.url().safeParse(url).success)) return null;
    if (visibility && visibility.toLowerCase() !== "public" && visibility.toLowerCase() !== "private") return null;
    return { title, url: url || null, contribution: contribution.slice(0, 500) || null, isPublic: visibility.toLowerCase() === "public" };
  });
  if (portfolio.some((item) => item === null)) return { error: "Portfolio lines use: title | https://link | your contribution | public (visibility and link are optional)." };
  const submit = parsed.data.intent === "SUBMIT";
  const availableFrom = parsed.data.availableFrom?.trim() ? new Date(`${parsed.data.availableFrom}T12:00:00.000Z`) : undefined;
  if (availableFrom && Number.isNaN(availableFrom.getTime())) return { error: "Enter a valid availability date." };
  const specialistCategories = splitList(parsed.data.categories);
  if (submit && parsed.data.context === "SPECIALIST" && (!parsed.data.headline?.trim() || !parsed.data.biography?.trim() || specialistCategories.length === 0)) {
    return { error: "Before review, add a headline, a short description, and at least one professional category." };
  }
  if (submit && parsed.data.context === "CREATOR" && (!parsed.data.biography?.trim() || specialistCategories.length === 0)) {
    return { error: "Before review, add a creator description and at least one content category." };
  }
  if (parsed.data.context === "SPECIALIST") {
    const previous = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true, verificationStatus: true } });
    const saved = {
      headline: parsed.data.headline || null,
      biography: parsed.data.biography || null,
      city: parsed.data.city || null,
      categories: specialistCategories,
      skills: splitList(parsed.data.skills),
      languages: splitList(parsed.data.languages),
      availability: parsed.data.availability || null,
      availabilityStatus: parsed.data.availabilityStatus ?? "UNSET",
      availableFrom: availableFrom ?? null,
      preferredDuration: parsed.data.preferredDuration || null,
      preferredArrangement: parsed.data.preferredArrangement || null,
      preferredEngagements: splitList(parsed.data.preferredEngagements),
      indicativeRate: rate ?? null,
      yearsExperience: yearsExperience ?? null,
      marketExperience: parsed.data.marketExperience || null,
      ...(submit || previous?.verificationStatus === "VERIFIED" ? { onboardingCompletedAt: new Date(), verificationStatus: "IN_REVIEW" as const, isPublished: false } : {}),
    };
    await db.$transaction(async (tx) => {
      const profile = await tx.professionalProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...saved },
        update: saved,
      });
      await tx.portfolioItem.deleteMany({ where: { profileId: profile.id } });
      if (portfolio.length) await tx.portfolioItem.createMany({ data: portfolio.filter((item): item is NonNullable<typeof item> => item !== null).map((item) => ({ ...item, profileId: profile.id })) });
    });
  } else {
    const previous = await db.creatorProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } });
    const saved = {
      biography: parsed.data.biography || null,
      platforms: splitList(parsed.data.platforms),
      contentCategories: specialistCategories,
      audienceEvidence: parsed.data.audienceEvidence || null,
      audienceSize: audienceSize ?? null,
      audienceGeography: parsed.data.audienceGeography || null,
      ...(submit || previous?.verificationStatus === "VERIFIED" ? { onboardingCompletedAt: new Date(), verificationStatus: "IN_REVIEW" as const, isPublished: false } : {}),
    };
    await db.creatorProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, country: "Nigeria", ...saved },
      update: saved,
    });
  }
  const entityType = parsed.data.context === "SPECIALIST" ? "ProfessionalProfile" : "CreatorProfile";
  await db.auditLog.create({ data: { actorId: user.id, action: submit ? "PROFILE_SUBMITTED_FOR_REVIEW" : "PROFILE_UPDATED", entityType, entityId: user.id } });
  return { success: submit ? "Profile submitted for human review. It remains private until an authorised reviewer records a decision." : "Profile details saved privately. Submit it for review when you are ready." };
}
