"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { sendAccountEmail } from "@/server/email";
import { consumeRateLimit, rateLimitKey } from "@/server/rate-limit";

export async function requestPasswordReset(_state: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const normalized = email.data.toLowerCase();
  const requestHeaders = await headers();
  const ip = (requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown").slice(0, 100);
  const allowed = await Promise.all([consumeRateLimit(rateLimitKey("password-reset-email", normalized), 4, 60 * 60), consumeRateLimit(rateLimitKey("password-reset-ip", ip), 15, 60 * 60)]);
  if (!allowed.every(Boolean)) return { message: "If an account uses that email, a password reset link has been sent." };
  const user = await db.user.findUnique({ where: { email: normalized }, select: { id: true, email: true } });
  if (user) {
    const raw = randomBytes(32).toString("hex");
    const token = createHash("sha256").update(raw).digest("hex");
    await db.verificationToken.deleteMany({ where: { identifier: user.email, purpose: "password_reset" } });
    await db.verificationToken.create({ data: { identifier: user.email, token, purpose: "password_reset", expires: new Date(Date.now() + 1000 * 60 * 30) } });
    const url = `${process.env.AUTH_URL ?? "http://localhost:3000"}/reset-password?token=${raw}`;
    try { await sendAccountEmail(user.email, "Reset your Kintovo password", url); }
    catch { return { error: "Password recovery email is not configured. Contact the platform administrator." }; }
  }
  return { message: "If an account uses that email, a password reset link has been sent." };
}
