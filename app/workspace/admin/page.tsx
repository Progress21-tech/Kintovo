import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const activeSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [accounts, activeUsers, businesses, submittedSpecialists, approvedSpecialists, submittedCreators, approvedCreators, approvedBusinesses, pendingBusinessGoals, openReviews, openDisputes, paymentExceptions, recentAudit, recentUsers, roleCounts, paymentTotals] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lastActiveAt: { gte: activeSince }, disabledAt: null, bannedAt: null } }),
    db.organisation.count(),
    db.professionalProfile.count({ where: { onboardingCompletedAt: { not: null } } }),
    db.professionalProfile.count({ where: { isPublished: true } }),
    db.creatorProfile.count({ where: { onboardingCompletedAt: { not: null } } }),
    db.creatorProfile.count({ where: { isPublished: true } }),
    db.organisation.count({ where: { projects: { some: { status: { in: ["MATCHING", "ACTIVE", "COMPLETED"] } } } } }),
    db.project.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.trustReview.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.compensationObligation.count({ where: { status: { in: ["FAILED", "DISPUTED"] } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, platformRole: true, disabledAt: true, bannedAt: true, createdAt: true, lastActiveAt: true } }),
    db.user.groupBy({ by: ["platformRole"], _count: { _all: true } }),
    db.compensationObligation.groupBy({ by: ["currency", "status"], _sum: { amount: true }, where: { status: { in: ["SIMULATED_PAID", "PROVIDER_CONFIRMED_PAID"] } } }),
  ]);
  const roleTotals = Object.fromEntries(roleCounts.map((item) => [item.platformRole, item._count._all]));
  const paidTotals = paymentTotals.map((item) => `${item.currency} ${(item._sum.amount ?? 0).toLocaleString("en-NG")} ${item.status === "SIMULATED_PAID" ? "simulated" : "provider-confirmed"}`);
  const links = [
    { href: "/workspace/admin/users", title: "People and accounts", description: "Review activity and profile status; suspend, restore, or permanently ban accounts." },
    { href: "/workspace/operations", title: "Operations overview", description: "Review queues, platform activity, and operational counts." },
    { href: "/workspace/operations/settings", title: "Feature controls", description: "Pause or enable new briefs, campaigns, and attribution." },
    { href: "/workspace/operations/trust", title: "Trust review", description: "Review submitted portfolio and market evidence." },
    { href: "/workspace/operations/finance", title: "Financial monitoring", description: "Inspect simulated obligations, settlements, refunds, and exceptions." },
    { href: "/workspace/operations/disputes", title: "Dispute review", description: "Record operational review decisions and resolution notes." },
    { href: "/workspace/operations/complaints", title: "Support complaints", description: "Review account complaints, record an outcome, and notify the user." },
    { href: "/workspace/operations/briefs", title: "Brief review", description: "Review business objectives before matching begins." },
    { href: "/workspace/reports", title: "Platform reports", description: "Review operational and financial reporting surfaces." },
  ];
  return <main className="app-main">
    <PageHeader eyebrow="Administration" title="Admin console" description="A platform overview with separate signup, profile completion, approval, and recent activity measures. Financial records are identified by their settlement status." />
    <section className="metric-grid admin-metrics" aria-label="Platform summary">
      <article className="metric"><span>Registered accounts</span><strong>{accounts}</strong><small>All account signups</small></article>
      <article className="metric"><span>Active in 30 days</span><strong>{activeUsers}</strong><small>Enabled accounts with tracked workspace activity</small></article>
      <article className="metric"><span>Business workspaces</span><strong>{businesses}</strong><small>{approvedBusinesses} with a goal approved for matching</small></article>
      <article className="metric"><span>Business goals awaiting review</span><strong>{pendingBusinessGoals}</strong><small>Submitted or in review</small></article>
      <article className="metric"><span>Specialist profiles completed</span><strong>{submittedSpecialists}</strong><small>{approvedSpecialists} published after review</small></article>
      <article className="metric"><span>Creator profiles completed</span><strong>{submittedCreators}</strong><small>{approvedCreators} published after review</small></article>
      <article className="metric"><span>Talent evidence reviews</span><strong>{openReviews}</strong><small>Awaiting action</small></article>
      <article className="metric"><span>Open disputes</span><strong>{openDisputes}</strong><small>Needs review</small></article>
      <article className="metric"><span>Payment exceptions</span><strong>{paymentExceptions}</strong><small>Failed or disputed obligations</small></article>
    </section>
    <div className="admin-console-grid">
      <section className="panel"><div className="panel-header"><h2>Platform management</h2></div><div className="panel-content admin-link-list">{links.map((link) => <Link href={link.href} key={link.href}><strong>{link.title}</strong><span>{link.description}</span><b aria-hidden="true">→</b></Link>)}</div></section>
      <section className="panel"><div className="panel-header"><h2>Recorded compensation</h2></div><div className="panel-content"><p className="field-note">Settled obligations are displayed by currency and settlement source. Simulated entries do not represent money moved.</p><ul className="review-history">{paidTotals.map((total) => <li key={total}><strong>{total}</strong></li>)}</ul>{!paidTotals.length && <p className="field-note">No obligations have been recorded as settled.</p>}</div></section>
      <section className="panel"><div className="panel-header"><h2>Recent audit activity</h2></div><div className="panel-content"><ul className="review-history">{recentAudit.map((item) => <li key={item.id}><div><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.actor?.name ?? "System"} · {item.entityType}</small></div><small>{item.createdAt.toLocaleDateString("en-NG")}</small></li>)}</ul>{!recentAudit.length && <p className="field-note">No audit activity has been recorded yet.</p>}</div></section>
    </div>
    <div className="admin-console-grid">
      <section className="panel"><div className="panel-header"><div><h2>Access governance</h2><span className="field-note">Platform roles are assigned by authorised administrators only.</span></div></div><div className="panel-content"><ul className="review-history">
        <li><div><strong>Administrators</strong><small>Platform-wide governance and configuration</small></div><span>{roleTotals.ADMIN ?? 0}</span></li>
        <li><div><strong>Operations</strong><small>Trust, briefs, campaigns, and disputes</small></div><span>{roleTotals.OPERATIONS ?? 0}</span></li>
        <li><div><strong>Finance</strong><small>Payment records and reconciliation</small></div><span>{roleTotals.FINANCE ?? 0}</span></li>
        <li><div><strong>Standard users</strong><small>Business, Specialist, and Creator contexts</small></div><span>{roleTotals.USER ?? 0}</span></li>
      </ul><p className="legal-note">Organisation OWNER, ADMIN, PROJECT_MANAGER, and MEMBER roles govern a single business workspace. They do not grant platform operations, finance, or admin access.</p></div></section>
      <section className="panel"><div className="panel-header"><h2>Recently registered accounts</h2><Link className="text-link" href="/workspace/admin/users">Manage accounts</Link></div><div className="panel-content"><ul className="review-history">{recentUsers.map((item) => <li key={item.id}><div><strong>{item.name}</strong><small>{item.email} · {item.platformRole} · joined {item.createdAt.toLocaleDateString("en-NG")} · active {item.lastActiveAt?.toLocaleDateString("en-NG") ?? "not yet"}</small></div><span>{item.bannedAt ? "Banned" : item.disabledAt ? "Suspended" : "Enabled"}</span></li>)}</ul>{!recentUsers.length && <p className="field-note">No accounts have been registered yet.</p>}</div></section>
    </div>
    <p className="legal-note">Live payment processing, custody, bank withdrawals, private file storage, identity decisions, and provider-specific integrations remain disabled until their external approvals and implementation are complete.</p>
  </main>;
}
