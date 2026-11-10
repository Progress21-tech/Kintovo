import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const [accounts, organisations, projects, openReviews, openDisputes, paymentExceptions, recentAudit] = await Promise.all([
    db.user.count(),
    db.organisation.count(),
    db.project.count(),
    db.trustReview.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.compensationObligation.count({ where: { status: { in: ["FAILED", "DISPUTED"] } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
  ]);
  const links = [
    { href: "/workspace/operations", title: "Operations overview", description: "Review queues, platform activity, and operational counts." },
    { href: "/workspace/operations/settings", title: "Feature controls", description: "Pause or enable new briefs, campaigns, and attribution." },
    { href: "/workspace/operations/trust", title: "Trust review", description: "Review submitted portfolio and market evidence." },
    { href: "/workspace/operations/finance", title: "Financial monitoring", description: "Inspect simulated obligations, settlements, refunds, and exceptions." },
    { href: "/workspace/operations/disputes", title: "Dispute review", description: "Record operational review decisions and resolution notes." },
    { href: "/workspace/operations/briefs", title: "Brief review", description: "Review business objectives before matching begins." },
  ];
  return <main className="app-main">
    <PageHeader eyebrow="Administration" title="Admin console" description="Manage platform operations, review queues, feature controls, and audit activity. Administrative actions are permission-protected and audit-logged." />
    <section className="metric-grid admin-metrics" aria-label="Platform summary">
      <article className="metric"><span>Accounts</span><strong>{accounts}</strong><small>Registered users</small></article>
      <article className="metric"><span>Organisations</span><strong>{organisations}</strong><small>Business workspaces</small></article>
      <article className="metric"><span>Projects</span><strong>{projects}</strong><small>Saved project records</small></article>
      <article className="metric"><span>Trust reviews</span><strong>{openReviews}</strong><small>Awaiting action</small></article>
      <article className="metric"><span>Open disputes</span><strong>{openDisputes}</strong><small>Needs review</small></article>
      <article className="metric"><span>Payment exceptions</span><strong>{paymentExceptions}</strong><small>Failed or disputed</small></article>
    </section>
    <div className="admin-console-grid">
      <section className="panel"><div className="panel-header"><h2>Platform management</h2></div><div className="panel-content admin-link-list">{links.map((link) => <Link href={link.href} key={link.href}><strong>{link.title}</strong><span>{link.description}</span><b aria-hidden="true">→</b></Link>)}</div></section>
      <section className="panel"><div className="panel-header"><h2>Recent audit activity</h2></div><div className="panel-content"><ul className="review-history">{recentAudit.map((item) => <li key={item.id}><div><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.actor?.name ?? "System"} · {item.entityType}</small></div><small>{item.createdAt.toLocaleDateString("en-NG")}</small></li>)}</ul>{!recentAudit.length && <p className="field-note">No audit activity has been recorded yet.</p>}</div></section>
    </div>
    <p className="legal-note">Live payment processing, custody, bank withdrawals, private file storage, identity decisions, and provider-specific integrations remain disabled until their external approvals and implementation are complete.</p>
  </main>;
}
