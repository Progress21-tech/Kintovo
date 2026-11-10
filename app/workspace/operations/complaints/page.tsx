import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { reviewComplaint } from "../../settings/actions";

const states = ["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED"] as const;

export default async function ComplaintsOperationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const { status: requested } = await searchParams;
  const status = states.includes(requested as typeof states[number]) ? requested as typeof states[number] : "OPEN";
  const complaints = await db.complaint.findMany({ where: { status }, include: { user: { select: { name: true, email: true, phone: true } }, assignedTo: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 150 });
  return <main className="app-main">
    <PageHeader eyebrow="Operations" title="Support complaints" description="Review account support and safety reports, record a response, and keep the status visible to the person who submitted it." />
    <form className="panel talent-search-form" method="get"><label>Queue<select name="status" defaultValue={status}>{states.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><button className="button button-primary">Open queue</button></form>
    <section className="review-list">{complaints.length ? complaints.map((item) => <article className="panel review-card" key={item.id}>
      <div className="panel-header"><div><h2>{item.subject}</h2><span className="field-note">{item.category.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</span></div><small>{item.createdAt.toLocaleString("en-NG")}</small></div>
      <div className="panel-content"><p className="review-objective">{item.description}</p><p className="field-note">Submitted by {item.user.name} ({item.user.email}){item.user.phone ? ` · ${item.user.phone}` : ""}{item.assignedTo ? ` · assigned to ${item.assignedTo.name}` : ""}</p>{item.staffNote && <p><strong>Previous update:</strong> {item.staffNote}</p>}
        {!(["RESOLVED", "CLOSED"].includes(item.status)) && <form action={reviewComplaint} className="review-decision-form"><input type="hidden" name="complaintId" value={item.id} /><label>Next status<select name="status" defaultValue={item.status === "OPEN" ? "UNDER_REVIEW" : item.status}><option value="UNDER_REVIEW">Under review</option><option value="AWAITING_RESPONSE">Awaiting user response</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></label><label>Response or internal action note<textarea name="staffNote" minLength={5} maxLength={2000} required defaultValue={item.staffNote ?? ""} /></label><button className="button button-primary">Save update and notify user</button></form>}
      </div>
    </article>) : <section className="panel empty-state"><div><h2>No complaints in this queue</h2><p>New account support and safety reports will appear here.</p></div></section>}</section>
  </main>;
}
