import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { sendNotificationEmail } from "@/server/email";

export { notificationCategories, channelEnabled, labelSimulated } from "@/server/notification-rules";
export type { NotificationCategory, PreferenceRow } from "@/server/notification-rules";
import { channelEnabled, labelSimulated, notificationCategories, type NotificationCategory } from "@/server/notification-rules";

type Client = PrismaClient | Prisma.TransactionClient;
export type NotifyInput = { userId: string; category: NotificationCategory; title: string; body: string; href?: string; simulated?: boolean };

/**
 * Records in-app notifications, honouring each user's preferences. Works inside a
 * transaction; email delivery happens afterwards via deliverPendingNotificationEmails.
 */
export async function notify(client: Client, inputs: NotifyInput | NotifyInput[]) {
  const list = (Array.isArray(inputs) ? inputs : [inputs]).filter((item) => item.userId);
  if (!list.length) return;
  const preferences = await client.notificationPreference.findMany({ where: { userId: { in: [...new Set(list.map((item) => item.userId))] } } });
  const rows = list.filter((item) => channelEnabled(preferences.filter((row) => row.userId === item.userId), item.category, "inApp") || channelEnabled(preferences.filter((row) => row.userId === item.userId), item.category, "email"));
  if (!rows.length) return;
  await client.notification.createMany({ data: rows.map((item) => ({
    userId: item.userId, category: item.category, href: item.href ?? null,
    title: labelSimulated(item.title, Boolean(item.simulated)).slice(0, 200), body: item.body.slice(0, 2000),
  })) });
}

/**
 * Background delivery job: emails recent notifications to users who opted in for
 * that category. Idempotent through `emailedAt`. Called after actions and by the
 * protected /api/jobs/notifications endpoint.
 */
export async function deliverPendingNotificationEmails(limit = 50) {
  if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) return { sent: 0, skipped: "SMTP is not configured" };
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const pending = await db.notification.findMany({ where: { emailedAt: null, createdAt: { gte: since } }, include: { user: { select: { email: true, bannedAt: true, disabledAt: true, notificationPreferences: true } } }, orderBy: { createdAt: "asc" }, take: limit * 4 });
  let sent = 0;
  for (const item of pending) {
    if (sent >= limit) break;
    const category = (item.category in notificationCategories ? item.category : "GENERAL") as NotificationCategory;
    const wantsEmail = !item.user.bannedAt && !item.user.disabledAt && channelEnabled(item.user.notificationPreferences, category, "email");
    // Claim first so concurrent workers never send the same notification twice.
    const claimed = await db.notification.updateMany({ where: { id: item.id, emailedAt: null }, data: { emailedAt: new Date() } });
    if (!claimed.count || !wantsEmail) continue;
    try {
      await sendNotificationEmail(item.user.email, item.title, item.body, item.href);
      sent += 1;
    } catch (error) {
      console.error("Notification email failed", { notificationId: item.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return { sent };
}

/** Fire-and-forget email dispatch after a request; never blocks or fails the action. */
export function scheduleNotificationEmails() {
  void deliverPendingNotificationEmails().catch(() => undefined);
}
