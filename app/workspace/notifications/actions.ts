"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser();
  const id = z.string().min(1).safeParse(formData.get("notificationId"));
  if (!id.success) return;
  await db.notification.updateMany({ where: { id: id.data, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/workspace/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/workspace/notifications");
}
