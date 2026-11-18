import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { summariseCampaign } from "@/server/attribution";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";

export default async function CampaignReportPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const user = await requireUser();
  const { campaignId } = await params;
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      organisation: { select: { name: true } },
      creators: { include: {
        creator: { include: { user: { select: { id: true, name: true } } } },
        content: { select: { status: true } },
        attributions: { select: { status: true, eventType: true, amount: true, bonusAmount: true, simulated: true, source: true } },
        fixedObligation: { select: { status: true, simulated: true } },
        _count: { select: { clicks: true } },
      } },
    },
  });
  if (!campaign) notFound();
  const membership = campaign.organisationId ? await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: campaign.organisationId, userId: user.id } } }) : null;
  const isManager = campaign.createdById === user.id || Boolean(membership && canManageProjects(membership.role)) || ["ADMIN", "OPERATIONS", "FINANCE"].includes(user.platformRole);
  const ownEntry = campaign.creators.find((entry) => entry.creator.user.id === user.id);
  if (!isManager && !ownEntry) notFound();
  // Creators see only their own results; managers see every creator.
  const entries = isManager ? campaign.creators : [ownEntry!];
  const contracted = entries.filter((entry) => ["ACCEPTED", "ACTIVE", "COMPLETED"].includes(entry.status));
  const rows = entries.map((entry) => ({ entry, summary: summariseCampaign({
    fixedFees: ["ACCEPTED", "ACTIVE", "COMPLETED"].includes(entry.status) ? entry.fixedFee : 0,
    attributions: entry.attributions, clicks: entry._count.clicks,
    approvedContent: entry.content.filter((item) => item.status === "APPROVED" || item.status === "PUBLISHED").length,
    publishedContent: entry.content.filter((item) => item.status === "PUBLISHED").length,
  }) }));
  const total = summariseCampaign({
    fixedFees: contracted.reduce((sum, entry) => sum + entry.fixedFee, 0),
    attributions: entries.flatMap((entry) => entry.attributions),
    clicks: entries.reduce((sum, entry) => sum + entry._count.clicks, 0),
    approvedContent: rows.reduce((sum, row) => sum + row.summary.approvedContent, 0),
    publishedContent: rows.reduce((sum, row) => sum + row.summary.publishedContent, 0),
  });
  const money = (value: number) => `${campaign.currency} ${value.toLocaleString("en-NG")}`;
  const sources = [...new Set(entries.flatMap((entry) => entry.attributions.map((item) => item.source)))];
  const tiles = [
    ["Clicks", total.clicks.toLocaleString("en-NG")], ["Leads", total.leads.toLocaleString("en-NG")],
    ["Eligible conversions", total.eligibleConversions.toLocaleString("en-NG")], ["Pending review", total.pendingConversions.toLocaleString("en-NG")],
    ["Refunded / cancelled", total.refunds.toLocaleString("en-NG")], ["Approved content", total.approvedContent.toLocaleString("en-NG")],
    ["Published content", total.publishedContent.toLocaleString("en-NG")], ["Fixed fees", money(total.fixedFees)],
    ["Earned bonuses", money(total.earnedBonuses)], ["Campaign expenditure", money(total.expenditure)],
  ];
  return <main className="app-main">
    <PageHeader eyebrow={`${campaign.organisation?.name ?? "Campaign"} · report`} title={campaign.title} description={`${campaign.status.replaceAll("_", " ")} · ${campaign.compensationModel.replace("_", " ").toLowerCase()} · last-click attribution within ${campaign.attributionWindowDays} days${campaign.budget ? ` · budget ${money(campaign.budget)}` : ""}`} action={<Link className="button button-secondary" href="/workspace/campaigns">All campaigns</Link>} />
    <p className={total.includesSimulatedData || !sources.length ? "notice" : "field-note"} role="note">
      {!sources.length ? "No conversion events have been recorded yet. Figures below come only from recorded clicks, content reviews, and contracts." :
        total.includesSimulatedData ? `This report includes test or manually entered events (sources: ${sources.join(", ").toLowerCase()}). They are not verified sales from an approved live integration.` :
        "Conversion figures come from signed integration events reviewed by Operations."}
    </p>
    {campaign.budget != null && total.expenditure > campaign.budget && <p className="form-alert" role="alert">Recorded expenditure exceeds the stated campaign budget.</p>}
    <section className="metric-grid" aria-label="Campaign totals" style={{ marginBottom: 16 }}>{tiles.map(([label, value]) => <div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className="panel"><div className="panel-header"><h2>{isManager ? "Results by creator" : "Your results"}</h2></div><div className="panel-content"><div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col">Creator</th><th scope="col">Status</th><th scope="col">Clicks</th><th scope="col">Leads</th><th scope="col">Eligible</th><th scope="col">Refunded</th><th scope="col">Attributed revenue</th><th scope="col">Fixed fee</th><th scope="col">Bonus earned</th><th scope="col">Fixed fee payment</th></tr></thead>
      <tbody>{rows.map(({ entry, summary }) => <tr key={entry.id}>
        <th scope="row">{entry.creator.user.name}</th><td>{entry.status.replaceAll("_", " ")}</td><td>{summary.clicks}</td><td>{summary.leads}</td><td>{summary.eligibleConversions}</td><td>{summary.refunds}</td>
        <td>{money(summary.attributedRevenue)}</td><td>{money(summary.fixedFees)}</td><td>{money(summary.earnedBonuses)}{entry.bonusCap != null ? ` (cap ${money(entry.bonusCap)})` : ""}</td>
        <td>{entry.fixedObligation ? <>{entry.fixedObligation.status.replaceAll("_", " ").toLowerCase()} {entry.fixedObligation.simulated && <span className="simulated-badge">Simulated</span>}</> : "No obligation yet"}</td>
      </tr>)}</tbody>
    </table></div>
    <p className="field-note" style={{ marginTop: 12 }}>Bonus = eligible order value × {entries[0] ? `${entries[0].bonusRate / 100}%` : "the agreed rate"}, limited by any agreed cap. Clicks are never counted as sales{campaign.refundTreatment === "INCLUDE_REFUNDED" ? "." : ", and refunded or cancelled orders are excluded."}</p>
    </div></section>
  </main>;
}
