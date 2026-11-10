import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const [accounts, organisations, businessUsers, specialists, creators, verifiedAccounts, disabledAccounts, projects, openReviews, openDisputes, paymentExceptions, recentAudit, recentUsers, roleCounts] = await Promise.all([
    db.user.count(),
    db.organisation.count(),
    db.organisationMembership.count({ where: { role: "OWNER" } }),
    db.professionalProfile.count(),
    db.creatorProfile.count(),
    db.user.count({ where: { emailVerifiedAt: { not: null } } }),
    db.user.count({ where: { disabledAt: { not: null } } }),
    db.project.count(),
    db.trustReview.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.compensationObligation.count({ where: { status: { in: ["FAILED", "DISPUTED"] } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, platformRole: true, disabledAt: true, createdAt: true } }),
    db.user.groupBy({ by: ["platformRole"], _count: { _all: true } }),
  ]);
  const roleTotals = Object.fromEntries(roleCounts.map((item) => [item.platformRole, item._count._all]));
  const links = [
    { href: "/workspace/operations", title: "Operations overview", description: "Review queues, platform activity, and operational counts." },
    { href: "/workspace/operations/settings", title: "Feature controls", description: "Pause or enable new briefs, campaigns, and attribution." },
    { href: "/workspace/operations/trust", title: "Trust review", description: "Review submitted portfolio and market evidence." },
    { href: "/workspace/operations/finance", title: "Financial monitoring", description: "Inspect simulated obligations, settlements, refunds, and exceptions." },
    { href: "/workspace/operations/disputes", title: "Dispute review", description: "Record operational review decisions and resolution notes." },
    { href: "/workspace/operations/briefs", title: "Brief review", description: "Review business objectives before matching begins." },
    { href: "/workspace/reports", title: "Platform reports", description: "Review operational and financial reporting surfaces." },
  ];
  return <main className="app-main">
    <PageHeader eyebrow="Administration" title="Admin console" description="Manage platform operations, review queues, feature controls, and audit activity. Administrative actions are permission-protected and audit-logged." />
    <section className="metric-grid admin-metrics" aria-label="Platform summary">
      <article className="metric"><span>Accounts</span><strong>{accounts}</strong><small>Registered users</small></article>
      <article className="metric"><span>Business organisations</span><strong>{organisations}</strong><small>Registered business workspaces</small></article>
      <article className="metric"><span>Business accounts</span><strong>{businessUsers}</strong><small>Organisation owners</small></article>
      <article className="metric"><span>Specialists</span><strong>{specialists}</strong><small>Professional profiles</small></article>
      <article className="metric"><span>Creators</span><strong>{creators}</strong><small>Creator profiles</small></article>
      <article className="metric"><span>Verified accounts</span><strong>{verifiedAccounts}</strong><small>Email or provider verified</small></article>
      <article className="metric"><span>Disabled accounts</span><strong>{disabledAccounts}</strong><small>Access currently blocked</small></article>
      <article className="metric"><span>Projects</span><strong>{projects}</strong><small>Saved project records</small></article>
      <article className="metric"><span>Trust reviews</span><strong>{openReviews}</strong><small>Awaiting action</small></article>
      <article className="metric"><span>Open disputes</span><strong>{openDisputes}</strong><small>Needs review</small></article>
      <article className="metric"><span>Payment exceptions</span><strong>{paymentExceptions}</strong><small>Failed or disputed</small></article>
    </section>
    <div className="admin-console-grid">
      <section className="panel"><div className="panel-header"><h2>Platform management</h2></div><div className="panel-content admin-link-list">{links.map((link) => <Link href={link.href} key={link.href}><strong>{link.title}</strong><span>{link.description}</span><b aria-hidden="true">→</b></Link>)}</div></section>
      <section className="panel"><div className="panel-header"><h2>Recent audit activity</h2></div><div className="panel-content"><ul className="review-history">{recentAudit.map((item) => <li key={item.id}><div><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.actor?.name ?? "System"} · {item.entityType}</small></div><small>{item.createdAt.toLocaleDateString("en-NG")}</small></li>)}</ul>{!recentAudit.length && <p className="field-note">No audit activity has been recorded yet.</p>}</div></section>
    </div>
    <div className="admin-console-grid">
      <section className="panel"><div className="panel-header"><div><h2>Access governance</h2><span className="field-note">Platform roles are assigned by authorised administrators only.</span></div></div><div className="panel-content"><ul className="review-history">
        <li><div><strong>Administrators</strong><small>Platform-wide governance and configuration</small></div><span>{roleTotals.ADMIN ?? 0}</span></li>
        <li><div><strong>Operations</strong><small>Trust, briefs, campaigns, and disputes</small></div><span>{roleTotals.OPERATIONS ?? 0}</span></li>
        <li><div><strong>Finance</strong><small>Payment records and reconciliation</small></div><span>{roleTotals.FINANCE ?? 0}</span></li>
        <li><div><strong>Standard users</strong><small>Business, Specialist, and Creator contexts</small></div><span>{roleTotals.USER ?? 0}</span></li>
      </ul><p className="legal-note">Organisation OWNER, ADMIN, PROJECT_MANAGER, and MEMBER roles govern a single business workspace. They do not grant platform operations, finance, or admin access.</p></div></section>
      <section className="panel"><div className="panel-header"><h2>Recently registered accounts</h2></div><div className="panel-content"><ul className="review-history">{recentUsers.map((item) => <li key={item.id}><div><strong>{item.name}</strong><small>{item.email} · {item.platformRole} · {item.createdAt.toLocaleDateString("en-NG")}</small></div><span>{item.disabledAt ? "Disabled" : "Active"}</span></li>)}</ul>{!recentUsers.length && <p className="field-note">No accounts have been registered yet.</p>}</div></section>
    </div>
    <p className="legal-note">Live payment processing, custody, bank withdrawals, private file storage, identity decisions, and provider-specific integrations remain disabled until their external approvals and implementation are complete.</p>
  </main>;
}
