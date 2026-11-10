import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { WithdrawalRequestForm } from "./WithdrawalRequestForm";

export default async function EarningsPage() {
  const user = await requireUser();
  const [specialist, creator, obligations, withdrawals] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.compensationObligation.findMany({ where: { recipientId: user.id }, include: { ledgerEntries: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.withdrawalRequest.findMany({ where: { userId: user.id }, orderBy: { requestedAt: "desc" }, take: 100 }),
  ]);
  if (!specialist && !creator) redirect("/workspace");

  const totals = obligations.reduce((result, obligation) => {
    const settled = obligation.ledgerEntries.filter((entry) => ["SIMULATED_SETTLEMENT", "PROVIDER_SETTLEMENT"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = obligation.ledgerEntries.filter((entry) => ["SIMULATED_REFUND", "PROVIDER_REFUND"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    result[obligation.currency] ??= { pending: 0, paid: 0, reserved: 0 };
    result[obligation.currency][obligation.status === "PENDING" ? "pending" : "paid"] += obligation.status === "PENDING" ? obligation.amount : Math.max(0, settled - refunded);
    return result;
  }, {} as Record<string, { pending: number; paid: number; reserved: number }>);
  for (const withdrawal of withdrawals) {
    if (["PENDING_REVIEW", "APPROVED"].includes(withdrawal.status)) {
      totals[withdrawal.currency] ??= { pending: 0, paid: 0, reserved: 0 };
      totals[withdrawal.currency].reserved += withdrawal.amount;
    }
  }
  const balances = Object.entries(totals);
  const availableTotal = balances.some(([, value]) => value.paid > value.reserved);

  return <main className="app-main">
    <PageHeader eyebrow={creator ? "Creator earnings" : "Specialist earnings"} title="Earnings and withdrawals" description="Review compensation records and request a withdrawal review. Provider payouts are not connected." action={<span className="status-pill amber">No live payouts</span>} />
    <section className="metric-grid earnings-metrics" aria-label="Earnings summary">
      {balances.length ? balances.map(([currency, value]) => <article className="metric" key={currency}><span>{currency} available</span><strong>{Math.max(0, value.paid - value.reserved).toLocaleString("en-NG")}</strong><small>{currency} {value.pending.toLocaleString("en-NG")} pending · {currency} {value.reserved.toLocaleString("en-NG")} reserved for review</small></article>) : <article className="metric"><span>Available earnings</span><strong>—</strong><small>Approved compensation will appear here</small></article>}
    </section>
    <section className="panel earnings-withdrawal"><div className="panel-header"><div><h2>Request a withdrawal review</h2><span className="field-note">Operations can review a request only after at least 24 hours.</span></div><span className="status-pill amber">No live payouts</span></div><div className="panel-content"><p>No bank details are collected. Approval records authorisation for a future provider payout; it does not initiate a transfer. Current settlement records are simulated.</p>{balances.map(([currency, value]) => { const available = Math.max(0, value.paid - value.reserved); return available > 0 ? <WithdrawalRequestForm key={currency} currency={currency} available={available} /> : null; })}{!availableTotal && <p className="field-note">No available settled earnings to request.</p>}</div></section>
    <section className="earnings-list"><h2 className="section-subhead">Withdrawal requests</h2>{withdrawals.length ? withdrawals.map((request) => <article className="panel earnings-row" key={request.id}><div><strong>{request.currency} {request.amount.toLocaleString("en-NG")}</strong><small>Requested {request.requestedAt.toLocaleString("en-NG")} · review opens {request.reviewAfter.toLocaleString("en-NG")}</small>{request.reviewNote && <small>{request.reviewNote}</small>}</div><span className={`status-pill ${request.status === "APPROVED" ? "green" : request.status === "REJECTED" ? "amber" : "blue"}`}>{request.status.replaceAll("_", " ")}</span></article>) : <p className="field-note">No withdrawal review requests yet.</p>}</section>
    <section className="earnings-list"><h2 className="section-subhead">Compensation history</h2>{obligations.length ? obligations.map((obligation) => <article className="panel earnings-row" key={obligation.id}><div><strong>{obligation.reference}</strong><small>{obligation.provider} · {obligation.simulated ? "Simulated record" : "Provider-confirmed record"} · {obligation.createdAt.toLocaleDateString("en-NG")}</small></div><div><strong>{obligation.currency} {obligation.amount.toLocaleString("en-NG")}</strong><span className={`status-pill ${obligation.status === "PROVIDER_CONFIRMED_PAID" || obligation.status === "SIMULATED_PAID" ? "green" : "amber"}`}>{obligation.status.replaceAll("_", " ")}</span></div></article>) : <section className="panel empty-state"><div><h3>No earnings yet</h3><p>Approved milestones and creator compensation records will appear here.</p></div></section>}</section>
  </main>;
}
