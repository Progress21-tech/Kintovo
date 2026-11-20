"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { optionalHttpUrl } from "@/server/validation";
import { db } from "@/server/db";
import { sendAccountEmail } from "@/server/email";
import { consumeRateLimit, rateLimitKey } from "@/server/rate-limit";
import { privacyVersion, termsVersion } from "@/server/policies";
import { ensurePagaOrganisationAccount, ensurePagaUserAccount } from "@/server/paga-accounts";

const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(12).max(200),
  acceptTerms: z.literal("on"),
  acceptPrivacy: z.literal("on"),
  context: z.enum(["BUSINESS", "SPECIALIST", "CREATOR"]),
  organisation: z.string().trim().max(120).optional(),
  website: optionalHttpUrl().optional(),
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
    acceptTerms: formData.get("acceptTerms"),
    acceptPrivacy: formData.get("acceptPrivacy"),
    context: formData.get("context"),
    organisation: formData.get("organisation") ?? undefined,
    website: formData.get("website") ?? "",
    industry: formData.get("industry") ?? undefined,
    model: formData.get("model") ?? undefined,
    product: formData.get("product") ?? undefined,
    location: formData.get("location") ?? undefined,
  });
  if (!parsed.success) {
    console.warn("[Kintovo auth] signup rejected: invalid input", { issues: parsed.error.issues.map((issue) => issue.message) });
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
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
  if (!allowed.every(Boolean)) {
    console.warn("[Kintovo auth] signup rejected: rate limited", { email: maskEmail(parsed.data.email) });
    return { error: "Too many account requests. Try again later." };
  }
  if (parsed.data.context === "BUSINESS" && !parsed.data.organisation) {
    console.warn("[Kintovo auth] signup rejected: organisation missing", { email: maskEmail(parsed.data.email) });
    return { error: "Enter your organisation name." };
  }
  if (requireEmailVerification && process.env.NODE_ENV === "production" && (!process.env.SMTP_HOST || !process.env.EMAIL_FROM)) {
    console.error("[Kintovo auth] signup rejected: verification email not configured", { email: maskEmail(parsed.data.email) });
    return { error: "Account verification email is not configured yet." };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const acceptedAt = new Date();
  let createdUserId: string | null = null;
  let createdOrganisationId: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash, termsAcceptedAt: acceptedAt, termsVersion, privacyAcceptedAt: acceptedAt, privacyVersion } });
      createdUserId = user.id;
      if (parsed.data.context === "BUSINESS") {
        const organisation = await tx.organisation.create({ data: {
          name: parsed.data.organisation!, website: parsed.data.website || null,
          industry: parsed.data.industry || null, model: parsed.data.model || null,
          product: parsed.data.product || null, location: parsed.data.location || null,
        } });
        createdOrganisationId = organisation.id;
        await tx.organisationMembership.create({ data: { organisationId: organisation.id, userId: user.id, role: "OWNER" } });
      } else if (parsed.data.context === "SPECIALIST") {
        await tx.professionalProfile.create({ data: { userId: user.id, categories: [], skills: [], languages: ["English"] } });
      } else {
        await tx.creatorProfile.create({ data: { userId: user.id, platforms: [], contentCategories: [] } });
      }
      await tx.verificationToken.create({ data: { identifier: parsed.data.email, token: tokenHash, purpose: "email_verification", expires: new Date(Date.now() + 1000 * 60 * 60 * 24) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "ACCOUNT_CREATED", entityType: "User", entityId: user.id, metadata: { termsVersion, privacyVersion } } });
    });
    if (requireEmailVerification) {
      const verifyUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/verify-email?token=${token}`;
      try {
        await sendAccountEmail(parsed.data.email, "Verify your Kintovo account", verifyUrl);
      } catch (error) {
        console.error("[Kintovo auth] signup verification email delivery failed", { email: maskEmail(parsed.data.email), error });
        return { error: "Your account was created, but we could not send the verification email. Please contact support." };
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.warn("[Kintovo auth] signup rejected: email already exists", { email: maskEmail(parsed.data.email) });
      return { error: "An account with that email already exists." };
    }
    console.error("[Kintovo auth] signup account creation failed", { email: maskEmail(parsed.data.email), error });
    return { error: "We could not create your account right now. Please try again later." };
  }
  // Provision the user's real Paga Sandbox account after the response is sent, so a
  // slow payment provider never delays sign-up. Registration remains available if Paga
  // is unreachable; the pending account can be retried from the funding/earnings pages.
  const organisationToProvision: string | null = createdOrganisationId;
  const userToProvision: string | null = createdUserId;
  const accountContext = parsed.data.context;
  after(async () => {
    try {
      if (organisationToProvision) await ensurePagaOrganisationAccount(organisationToProvision);
      else if (userToProvision) await ensurePagaUserAccount(userToProvision);
    } catch (error) {
      console.error("Paga Sandbox account provisioning did not complete", { accountContext, error });
    }
  });
  console.info("[Kintovo auth] signup accepted", { email: maskEmail(parsed.data.email), requireEmailVerification });
  return {
    success: requireEmailVerification
      ? "Account created. Use the verification link sent to your email before signing in."
      : "Account created. You can sign in now. Email verification will be required when it is enabled.",
  };
}
