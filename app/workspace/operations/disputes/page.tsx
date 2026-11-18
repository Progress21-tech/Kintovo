import Link from "next/link";
import { redirect } from "next/navigation";
import { FileList } from "@/components/FileList";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { resolveDispute } from "./actions";

const statusOptions = [
  ["AWAITING_EVIDENCE", "Awaiting evidence"],
  ["UNDER_REVIEW", "Under review"],
  ["AWAITING_RESPONSE", "Awaiting response"],
  ["ESCALATED", "Escalated"],
  ["RESOLVED", "Resolved (record outcome)"],
  ["CLOSED", "Closed"],
] as const;

export default async function DisputesOperationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS"].includes(user.platformRole)) redirect("/workspace");
  const { view } = await searchParams;
  const showClosed = view === "closed";
  const disputes = await db.dispute.findMany({
    where: showClosed ? { status: "CLOSED" } : { status: { not: "CLOSED" } },
    include: {
      openedBy: { select: { name: true, email: true } },
      assignedReviewer: { select: { name: true } },
      project: { select: { id: true, title: true, organisation: { select: { name: true } } } },
      milestone: { select: { title: true, amount: true, currency: true, status: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      files: { where: { deletedAt: null }, select: { id: true, originalName: true, sizeBytes: true } },
    },
    orderBy: { createdAt: "asc" }, take: 100,
  });
  return <main className="app-main"><PageHeader eyebrow="Operations" title="Dispute review" description="Assign a reviewer, request evidence, keep internal notes, and record an outcome. These records do not determine legal liability, and no funds are held or recovered by this workflow." action={<Link className="text-link" href={showClosed ? "/workspace/operations/disputes" : "/workspace/operations/disputes?view=closed"}>{showClosed ? "Show active disputes" : "Show closed disputes"}</Link>} />
    {disputes.length ? <section className="review-list">{disputes.map((item) => <article className="panel review-card" key={item.id}>
      <div className="panel-header"><div><h2>{item.issueType}</h2><span className="field-note">{item.project.organisation.name} · <Link className="text-link" href={`/workspace/projects/${item.project.id}#disputes`}>{item.project.title}</Link> · {item.status.replaceAll("_", " ")}</span></div><span className="status-pill">{item.assignedReviewer ? `Reviewer: ${item.assignedReviewer.name}` : "Unassigned"}</span></div>
      <div className="panel-content">
        <p>{item.description}</p>
        <p className="field-note">Opened by {item.openedBy.name} ({item.openedBy.email}) · {item.milestone ? `${item.milestone.title} (${item.milestone.currency} ${item.milestone.amount.toLocaleString("en-NG")}, ${item.milestone.status})` : "Project-wide"} · Agreement version {item.agreementVersion ?? "not linked"} · Amount affected {item.amountAffected?.toLocaleString("en-NG") ?? "not stated"} · {item.createdAt.toLocaleString("en-NG")}</p>
        <FileList files={item.files} label="Evidence" />
        {item.notes.length > 0 && <details className="workflow-details" open><summary>Case timeline ({item.notes.length})</summary><ul>{item.notes.map((note) => <li key={note.id}>{note.createdAt.toLocaleString("en-NG")} · {note.author.name}{note.visibility === "STAFF" ? " · internal" : ""} — {note.body}</li>)}</ul></details>}
        {item.resolution && <p className="notice">Recorded outcome: {item.resolution}</p>}
        {item.status !== "CLOSED" && <form action={resolveDispute} className="review-decision-form">
          <input type="hidden" name="disputeId" value={item.id} />
          <div className="field-grid">
            <label>Next status<select name="status" defaultValue={item.status === "RESOLVED" ? "CLOSED" : "UNDER_REVIEW"}>{statusOptions.filter(([value]) => item.status !== "RESOLVED" || value === "CLOSED").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Note visibility<select name="visibility" defaultValue="PARTIES"><option value="PARTIES">Visible to both parties</option><option value="STAFF">Internal Operations note</option></select></label>
          </div>
          <label>Review note or outcome<textarea name="resolution" minLength={10} maxLength={2000} required /></label>
          <label className="checkbox-row"><input type="checkbox" name="assignToMe" defaultChecked={!item.assignedReviewer} /> Assign this dispute to me</label>
          <label className="checkbox-row"><input type="checkbox" name="confirm" value="yes" /> I confirm this outcome when resolving or closing (both parties are notified)</label>
          <button className="button button-primary">Save dispute review</button>
        </form>}
      </div></article>)}</section> : <section className="panel empty-state"><div><h2>{showClosed ? "No closed disputes" : "No active disputes"}</h2><p>Project dispute records will appear in this queue.</p></div></section>}
  </main>;
}
