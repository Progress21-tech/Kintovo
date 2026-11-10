"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function updateAccountAccess(formData: FormData) {
  const actor = await requireUser();
  if (actor.platformRole !== "ADMIN") redirect("/workspace");
  const parsed = z.object({
    userId: z.string().min(1),
    action: z.enum(["SUSPEND", "RESTORE", "BAN"]),
    reason: z.string().trim().min(8).max(1000),
  }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success || parsed.data.userId === actor.id) return;
  const target = await db.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, disabledAt: true, bannedAt: true } });
  if (!target || target.bannedAt && parsed.data.action !== "BAN") return;
  const now = new Date();
  const change = parsed.data.action === "SUSPEND"
    ? { disabledAt: now }
    : parsed.data.action === "RESTORE"
      ? { disabledAt: null }
      : { disabledAt: now, bannedAt: now, banReason: parsed.data.reason };
  if (parsed.data.action === "SUSPEND" && target.disabledAt || parsed.data.action === "RESTORE" && !target.disabledAt || parsed.data.action === "BAN" && target.bannedAt) return;
  await db.$transaction([
    db.user.update({ where: { id: target.id }, data: change }),
    db.auditLog.create({
      data: {
        actorId: actor.id,
        action: `ACCOUNT_${parsed.data.action}`,
        entityType: "User",
        entityId: target.id,
        metadata: { reason: parsed.data.reason },
      },
    }),
  ]);
  revalidatePath("/workspace/admin");
  revalidatePath("/workspace/admin/users");
}
