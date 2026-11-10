import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function OperationsHome() {
  const user = await requireUser();
  if (!["ADMIN", "OPERATIONS", "FINANCE"].includes(user.platformRole)) redirect("/workspace");
  const [users, projects, openBriefs, trustRequests, activeCampaigns, pendingConversions, openDisputes, openComplaints, obligations, recentAudit, pendingWithdrawals] = await Promise.all([
    db.user.count(), db.project.count(), db.project.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    db.trustReview.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }), db.campaign.count({ where: { status: { in: ["INVITING", "ACTIVE"] } } }),
    db.campaignAttribution.count({ where: { status: "PENDING" } }), db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.complaint.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE"] } } }),
    db.compensationObligation.count({ where: { status: { in: ["PENDING", "FAILED", "DISPUTED"] } } }), db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { actor: { select: { name: true } } } }),
    db.withdrawalRequest.count({ where: { status: "PENDING_REVIEW" } }),
  ]);
  return <main className="app-main"><PageHeader eyebrow="Operations" title="Platform overview" description="Operational queue counts and recent audit activity. These counts describe records in this installation, not marketplace traction." />
    <div className="metric-grid"><article className="metric"><span>Accounts</span><strong>{users}</strong></article><article className="metric"><span>Project briefs</span><strong>{projects}</strong></article><article className="metric"><span>Briefs awaiting review</span><strong>{openBriefs}</strong></article><article className="metric"><span>Trust requests</span><strong>{trustRequests}</strong></article><article className="metric"><span>Active campaigns</span><strong>{activeCampaigns}</strong></article><article className="metric"><span>Conversions to review</span><strong>{pendingConversions}</strong></article><article className="metric"><span>Open disputes</span><strong>{openDisputes}</strong></article><article className="metric"><span>Support complaints</span><strong>{openComplaints}</strong></article><article className="metric"><span>Withdrawal requests</span><strong>{pendingWithdrawals}</strong></article><article className="metric"><span>Payment exceptions</span><strong>{obligations}</strong></article></div>
    <div className="dashboard-grid operations-links"><section className="panel"><div className="panel-header"><h2>Review queues</h2></div><div className="panel-content operations-link-list"><Link href="/workspace/operations/briefs">Brief review <span>{openBriefs}</span></Link><Link href="/workspace/operations/trust">Talent evidence review <span>{trustRequests}</span></Link><Link href="/workspace/operations/assessments">Skills assessments</Link><Link href="/workspace/operations/campaigns">Campaigns and test attribution <span>{pendingConversions}</span></Link>{["ADMIN", "OPERATIONS"].includes(user.platformRole) && <Link href="/workspace/operations/complaints">Support complaints <span>{openComplaints}</span></Link>}{user.platformRole === "ADMIN" && <Link href="/workspace/operations/disputes">Dispute review <span>{openDisputes}</span></Link>}{["ADMIN", "FINANCE"].includes(user.platformRole) && <Link href="/workspace/operations/finance">Compensation ledger <span>{obligations}</span></Link>}{user.platformRole === "ADMIN" && <Link href="/workspace/operations/settings">Platform settings</Link>}</div></section>
      <section className="panel"><div className="panel-header"><h2>Recent audit activity</h2></div><div className="panel-content"><ul className="review-history">{recentAudit.map((item) => <li key={item.id}><div><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.actor?.name ?? "System"} · {item.entityType} · {item.createdAt.toLocaleString("en-NG")}</small></div></li>)}</ul>{!recentAudit.length && <p className="field-note">Audit events appear as workflows are used.</p>}</div></section></div>
  </main>;
}
