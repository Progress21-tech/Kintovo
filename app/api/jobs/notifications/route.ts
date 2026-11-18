import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { deliverPendingNotificationEmails, notify } from "@/server/notifications";

function authorised(request: Request) {
  const secret = process.env.JOB_SECRET ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (secret.length < 24 || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

/**
 * Scheduled job (call every 10–15 minutes from a cron service with
 * `Authorization: Bearer $JOB_SECRET`). Sends task-deadline reminders once per task
 * and delivers opted-in notification emails.
 */
export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await db.projectTask.findMany({
    where: { dueAt: { gte: now, lte: soon }, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] }, assigneeProfileId: { not: null }, project: { status: "ACTIVE" } },
    include: { assignee: { select: { userId: true } } },
    take: 500,
  });
  let reminders = 0;
  for (const task of tasks) {
    if (!task.assignee) continue;
    const href = `/workspace/projects/${task.projectId}#task-${task.id}`;
    const exists = await db.notification.findFirst({ where: { userId: task.assignee.userId, href, title: "Task due within 24 hours" }, select: { id: true } });
    if (exists) continue;
    await notify(db, { userId: task.assignee.userId, category: "TASK", title: "Task due within 24 hours", body: `“${task.title}” is due ${task.dueAt!.toLocaleString("en-NG")}.`, href });
    reminders += 1;
  }
  const email = await deliverPendingNotificationEmails(100);
  return Response.json({ reminders, email });
}
