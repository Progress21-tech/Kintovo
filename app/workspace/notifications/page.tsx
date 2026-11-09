import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notifications.filter((item) => !item.readAt).length;
  return <main className="app-main"><PageHeader eyebrow="Your workspace" title="Notifications" description={`${unread} unread update${unread === 1 ? "" : "s"}.`} action={unread > 0 ? <form action={markAllNotificationsRead}><button className="button button-secondary">Mark all read</button></form> : undefined} />
    {notifications.length ? <section className="review-list">{notifications.map((item) => <article className={`panel notification-card${item.readAt ? " read" : " unread"}`} key={item.id}><div className="panel-content"><div className="offer-heading"><div><h2>{item.title}</h2><small>{item.createdAt.toLocaleString("en-NG")}</small></div>{!item.readAt && <span className="status-pill coral">New</span>}</div><p>{item.body}</p>{!item.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={item.id} /><button className="text-link">Mark as read</button></form>}</div></article>)}</section> : <section className="panel empty-state"><div><h2>You’re all caught up</h2><p>Project, profile, and campaign updates will appear here.</p></div></section>}
  </main>;
}
