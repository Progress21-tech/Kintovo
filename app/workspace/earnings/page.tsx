import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function EarningsPage() {
  const user = await requireUser();
  const [specialist, creator, obligations] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.compensationObligation.findMany({
      where: { recipientId: user.id },
      include: { ledgerEntries: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  if (!specialist && !creator) redirect("/workspace");

  const totals = obligations.reduce((result, obligation) => {
    const settled = obligation.ledgerEntries.filter((entry) => ["SIMULATED_SETTLEMENT", "PROVIDER_SETTLEMENT"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = obligation.ledgerEntries.filter((entry) => ["SIMULATED_REFUND", "PROVIDER_REFUND"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    const paid = Math.max(0, settled - refunded);
    const bucket = obligation.status === "PENDING" ? "pending" : "paid";
    result[obligation.currency] ??= { pending: 0, paid: 0 };
    result[obligation.currency][bucket] += bucket === "paid" ? paid : obligation.amount;
    return result;
  }, {} as Record<string, { pending: number; paid: number }>);

  return <main className="app-main">
    <PageHeader eyebrow={creator ? "Creator earnings" : "Specialist earnings"} title="Earnings and withdrawals" description="Review compensation records linked to your approved work. Bank withdrawals will be enabled after the payment provider is connected." action={<span className="status-pill amber">Provider setup pending</span>} />
    <section className="metric-grid earnings-metrics" aria-label="Earnings summary">
      {Object.entries(totals).length ? Object.entries(totals).map(([currency, value]) => <article className="metric" key={currency}><span>{currency} available</span><strong>{value.paid.toLocaleString("en-NG")}</strong><small>{currency} {value.pending.toLocaleString("en-NG")} pending</small></article>) : <article className="metric"><span>Available earnings</span><strong>—</strong><small>Approved compensation will appear here</small></article>}
    </section>
    <section className="panel earnings-withdrawal"><div className="panel-header"><div><h2>Withdraw to bank account</h2><span className="field-note">Paystack transfers are not enabled yet.</span></div><span className="status-pill amber">Unavailable</span></div><div className="panel-content"><p>Your earnings are recorded against your Kintovo account, but no bank details are collected and no withdrawal is initiated until provider payout support is configured and approved.</p><span className="button button-secondary button-disabled" aria-disabled="true">Connect bank account when available</span></div></section>
    <section className="earnings-list"><h2 className="section-subhead">Compensation history</h2>{obligations.length ? obligations.map((obligation) => <article className="panel earnings-row" key={obligation.id}><div><strong>{obligation.reference}</strong><small>{obligation.provider} · {obligation.simulated ? "Simulated record" : "Provider-confirmed record"} · {obligation.createdAt.toLocaleDateString("en-NG")}</small></div><div><strong>{obligation.currency} {obligation.amount.toLocaleString("en-NG")}</strong><span className={`status-pill ${obligation.status === "PROVIDER_CONFIRMED_PAID" || obligation.status === "SIMULATED_PAID" ? "green" : "amber"}`}>{obligation.status.replaceAll("_", " ")}</span></div></article>) : <section className="panel empty-state"><div><h3>No earnings yet</h3><p>Approved milestones and creator compensation records will appear here.</p></div></section>}</section>
  </main>;
}
