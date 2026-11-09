import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { resolveDispute } from "./actions";

export default async function DisputesOperationsPage() {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const disputes = await db.dispute.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, include: { openedBy: { select: { name: true, email: true } }, project: { select: { id: true, title: true, organisation: { select: { name: true } } } }, milestone: { select: { title: true } } }, orderBy: { createdAt: "asc" }, take: 100 });
  return <main className="app-main"><PageHeader eyebrow="Operations" title="Dispute review" description="Record an operational review and outcome. These records do not determine legal liability or move funds." />
    {disputes.length ? <section className="review-list">{disputes.map((item) => <article className="panel review-card" key={item.id}><div className="panel-header"><div><h2>{item.issueType}</h2><span className="field-note">{item.project.organisation.name} · {item.project.title} · {item.status}</span></div></div><div className="panel-content"><p>{item.description}</p><p className="field-note">Opened by {item.openedBy.name} ({item.openedBy.email}) · {item.milestone?.title ?? "Project-wide"} · {item.createdAt.toLocaleString("en-NG")}</p><form action={resolveDispute} className="review-decision-form"><input type="hidden" name="disputeId" value={item.id} /><label>Decision<select name="status" defaultValue="UNDER_REVIEW"><option value="UNDER_REVIEW">Under review</option><option value="AWAITING_RESPONSE">Awaiting response</option><option value="RESOLVED">Resolved</option><option value="ESCALATED">Escalated</option><option value="CLOSED">Closed</option></select></label><label>Resolution/review note<textarea name="resolution" minLength={10} maxLength={2000} required /></label><button className="button button-primary">Save dispute review</button></form></div></article>)}</section> : <section className="panel empty-state"><div><h2>No open disputes</h2><p>New project dispute records will appear in this queue.</p></div></section>}
  </main>;
}
