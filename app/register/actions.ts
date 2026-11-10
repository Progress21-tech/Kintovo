"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { sendAccountEmail } from "@/server/email";
import { consumeRateLimit, rateLimitKey } from "@/server/rate-limit";

const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(200),
  context: z.enum(["BUSINESS", "SPECIALIST", "CREATOR"]),
  organisation: z.string().trim().max(120).optional(),
  website: z.union([z.literal(""), z.url()]).optional(),
  industry: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  product: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
});

export async function registerAccount(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    context: formData.get("context"),
    organisation: formData.get("organisation") ?? undefined,
    website: formData.get("website") ?? "",
    industry: formData.get("industry") ?? undefined,
    model: formData.get("model") ?? undefined,
    product: formData.get("product") ?? undefined,
    location: formData.get("location") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown").slice(0, 100);
  let allowed: boolean[];
  try {
    allowed = await Promise.all([
      consumeRateLimit(rateLimitKey("register-email", parsed.data.email), 5, 60 * 60),
      consumeRateLimit(rateLimitKey("register-ip", ip), 20, 60 * 60),
    ]);
  } catch (error) {
    console.error("Signup rate-limit check failed", error);
    return { error: "Signup is temporarily unavailable. Please try again later." };
  }
  if (!allowed.every(Boolean)) return { error: "Too many account requests. Try again later." };
  if (parsed.data.context === "BUSINESS" && !parsed.data.organisation) return { error: "Enter your organisation name." };
  if (process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !process.env.EMAIL_FROM)) return { error: "Account verification email is not configured yet." };

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash } });
      if (parsed.data.context === "BUSINESS") {
        const organisation = await tx.organisation.create({ data: {
          name: parsed.data.organisation!, website: parsed.data.website || null,
          industry: parsed.data.industry || null, model: parsed.data.model || null,
          product: parsed.data.product || null, location: parsed.data.location || null,
        } });
        await tx.organisationMembership.create({ data: { organisationId: organisation.id, userId: user.id, role: "OWNER" } });
      } else if (parsed.data.context === "SPECIALIST") {
        await tx.professionalProfile.create({ data: { userId: user.id, categories: [], skills: [], languages: ["English"] } });
      } else {
        await tx.creatorProfile.create({ data: { userId: user.id, platforms: [], contentCategories: [] } });
      }
      await tx.verificationToken.create({ data: { identifier: parsed.data.email, token: tokenHash, purpose: "email_verification", expires: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ACCOUNT_CREATED", entityType: "User", entityId: user.id } });
    });
    const verifyUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/verify-email?token=${token}`;
    await sendAccountEmail(parsed.data.email, "Verify your Kintovo account", verifyUrl);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) return { error: "An account with that email already exists." };
    console.error("Signup account creation failed", error);
    return { error: "We could not create your account right now. Please try again later." };
  }
  try {
  } catch (error) {
    console.error("Signup verification email delivery failed", error);
    return { error: "Your account was created, but we could not send the verification email. Please contact support." };
  }
  return { success: "Account created. Use the verification link sent to your email before signing in." };
}
