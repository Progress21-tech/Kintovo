"use server";

import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";

export async function resetPassword(_state: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const parsed = z.object({ token: z.string().min(20), password: z.string().min(12).max(200) }).safeParse({ token: formData.get("token"), password: formData.get("password") });
  if (!parsed.success) return { error: "Use a valid reset link and a password of at least 12 characters." };
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await db.verificationToken.findFirst({ where: { token: hash, purpose: "password_reset", expires: { gt: new Date() } } });
  if (!record) return { error: "That reset link has expired or was already used." };
  const user = await db.user.findUnique({ where: { email: record.identifier }, select: { id: true } });
  if (!user) return { error: "That reset link has expired or was already used." };
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.verificationToken.delete({ where: { token: hash } }),
    db.auditLog.create({ data: { actorId: user.id, action: "PASSWORD_RESET", entityType: "User", entityId: user.id } }),
  ]);
  redirect("/sign-in?notice=password-updated");
}
