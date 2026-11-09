"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { sendAccountEmail } from "@/server/email";

export async function requestPasswordReset(_state: { message?: string; error?: string }, formData: FormData) {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const user = await db.user.findUnique({ where: { email: email.data.toLowerCase() }, select: { id: true, email: true } });
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
