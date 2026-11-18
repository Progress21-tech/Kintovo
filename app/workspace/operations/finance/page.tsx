import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { adjustObligation, reconcileLedger, reconcilePagaCompensation, reconcilePagaWithdrawal, reimburseReversedWithdrawal, reviewWithdrawalRequest, simulateFailure, simulateRefund, simulateSettlement } from "./actions";

export default async function FinanceOperationsPage() {
  const user = await requireUser();
  if (!["ADMIN", "FINANCE"].includes(user.platformRole)) redirect("/workspace");
  const [obligations, withdrawals] = await Promise.all([
    db.compensationObligation.findMany({ include: { recipient: { select: { name: true, email: true } }, pagaTransfer: true, ledgerEntries: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.withdrawalRequest.findMany({ where: { status: { in: ["PENDING_REVIEW", "PROCESSING", "PAYOUT_FAILED"] } }, include: { user: { select: { id: true, name: true, email: true, pagaAccount: { select: { status: true, accountNumber: true } } } }, pagaBankDestination: { select: { id: true, bankName: true, accountNumberLast4: true, accountHolderName: true, validatedAt: true } }, pagaPayout: { include: { bankDestination: { select: { bankName: true, accountNumberLast4: true } } } } }, orderBy: { reviewAfter: "asc" }, take: 200 }),
  ]);
  const unresolved = obligations.filter((item) => ["PENDING", "FAILED", "DISPUTED"].includes(item.status)).length;
  const simulatedSettled = obligations.filter((item) => item.status === "SIMULATED_PAID").reduce((sum, item) => sum + item.amount, 0);
  return <main className="app-main">
    <PageHeader eyebrow="Operations · Finance" title="Compensation ledger" description="Review withdrawal requests and reconcile Paga Sandbox transfers. Simulated compensation remains separate from provider payments." action={<span className="status-pill amber">Paga Sandbox</span>} />
    <div className="metric-grid"><article className="metric"><span>Obligations</span><strong>{obligations.length}</strong><small>Recorded in the database</small></article><article className="metric"><span>Unresolved</span><strong>{unresolved}</strong><small>Pending, failed, or disputed</small></article><article className="metric"><span>Simulated paid</span><strong>{simulatedSettled.toLocaleString("en-NG")}</strong><small>In listed record currencies</small></article></div>
    <form action={reconcileLedger} className="inline-form finance-reconcile"><button className="button button-secondary">Run ledger reconciliation</button><span className="field-note">Checks up to 1,000 obligations and records exceptions in the audit trail.</span></form>
    <section className="review-list"><h2 className="section-subhead">Paga withdrawal review and reconciliation</h2>{withdrawals.length ? withdrawals.map((request) => {
      const ready = request.reviewAfter <= new Date();
      const bank = request.pagaBankDestination;
      const canApprove = request.currency === "NGN" && request.user.pagaAccount?.status === "ACTIVE" && Boolean(request.user.pagaAccount.accountNumber) && Boolean(bank?.validatedAt);
      return <article className="panel review-card" key={request.id}>
        <div className="panel-header"><div><h2>{request.currency} {request.amount.toLocaleString("en-NG")}</h2><span className="field-note">{request.user.name} · {request.user.email} · requested {request.requestedAt.toLocaleString("en-NG")}</span></div><span className={`status-pill ${request.status === "PROCESSING" ? "blue" : request.status === "PAYOUT_FAILED" ? "amber" : ready ? "blue" : "amber"}`}>{request.status === "PENDING_REVIEW" ? ready ? "24-hour review period complete" : `Available after ${request.reviewAfter.toLocaleString("en-NG")}` : request.status.replaceAll("_", " ")}</span></div>
        <div className="panel-content">{request.status === "PENDING_REVIEW" ? <>
          <p><strong>Validated destination:</strong> {bank ? `${bank.bankName} ···· ${bank.accountNumberLast4} · ${bank.accountHolderName}` : "Not linked"}</p>
          {!canApprove && <p className="form-alert">Approval is blocked until the user has an active Paga account and a bank account validated by Paga.</p>}
          {request.reviewNote && <p className="field-note">Latest review detail: {request.reviewNote}</p>}
          {ready ? <form action={reviewWithdrawalRequest} className="review-decision-form"><input type="hidden" name="requestId" value={request.id} /><label>Decision<select name="decision"><option value="APPROVED" disabled={!canApprove}>Approve and send via Paga Sandbox</option><option value="REJECTED">Reject and release reserved balance</option></select></label><label>Review note<textarea name="note" minLength={8} maxLength={1000} required /></label><button className="button button-primary">Submit finance decision</button></form> : <p className="field-note">The 24-hour review hold has not elapsed.</p>}
        </> : request.status === "PROCESSING" ? <>
          <p><strong>Paga payout reference:</strong> {request.pagaPayout?.payoutReference ?? "Not created"}</p>
          {request.pagaPayout && <p><strong>Beneficiary:</strong> {request.pagaPayout.bankDestination.bankName} · account ending {request.pagaPayout.bankDestination.accountNumberLast4}</p>}
          {request.pagaPayout?.estimatedFeeMinor !== null && request.pagaPayout?.estimatedFeeMinor !== undefined && <p><strong>Estimated payout fee and VAT:</strong> NGN {((Number(request.pagaPayout.estimatedFeeMinor) + Number(request.pagaPayout.estimatedVatMinor ?? 0)) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
          {request.pagaPayout?.failureReason && <p className="form-alert">{request.pagaPayout.failureReason}</p>}
          {request.pagaPayout && <form action={reconcilePagaWithdrawal}><input type="hidden" name="payoutId" value={request.pagaPayout.id} /><button className="button button-secondary button-small">{request.pagaPayout.payoutStartedAt ? "Check Paga transfer status" : "Continue payout after balance check"}</button></form>}
          {request.pagaPayout && request.status === "PROCESSING" && <form action={reimburseReversedWithdrawal} className="review-decision-form"><input type="hidden" name="payoutId" value={request.pagaPayout.id} /><label>Finance reconciliation note<textarea name="note" minLength={12} maxLength={1000} required placeholder="Explain the Paga reversal you are reconciling." /></label><button className="button button-secondary button-small">Reimburse confirmed reversal</button></form>}
          <p className="field-note">If Paga has not received a bank payout request yet, this action reruns beneficiary, fee, and available-balance checks before sending it. Once submitted, status checks never send a second bank payout. Reimbursement is available only after Paga's authenticated status response confirms a reversal for the exact amount; the withdrawal stays reserved until its signed account-credit callback.</p>
        </> : <>
          <p><strong>Paga payout reference:</strong> {request.pagaPayout?.payoutReference ?? "Not created"}</p>
          {request.pagaPayout?.reimbursedAt && <p className="field-note">Reimbursed to the user's Paga account on {request.pagaPayout.reimbursedAt.toLocaleString("en-NG")}.</p>}
          {request.pagaPayout?.failureReason && <p className="form-alert">{request.pagaPayout.failureReason}</p>}
          <p className="field-note">This payout request is closed. Review its audit history before taking further action.</p>
        </>}</div>
      </article>;
    }) : <p className="field-note">No withdrawal requests need finance review.</p>}</section>
    <section className="review-list"><h2 className="section-subhead">Obligations</h2>{obligations.length ? obligations.map((item) => <article className="panel" key={item.id}><div className="panel-header"><div><h2>{item.reference}</h2><span className="field-note">{item.recipient?.name ?? "Recipient not recorded"} · {item.projectId ?? "No project"} · {item.provider}</span></div><span className="status-pill">{item.status.replaceAll("_", " ")}{item.simulated ? " · simulated" : ""}</span></div><div className="panel-content"><p><strong>{item.currency} {item.amount.toLocaleString("en-NG")}</strong> · Created {item.createdAt.toLocaleString("en-NG")}</p>{item.failureReason && <p className="field-note">{item.failureReason}</p>}
      {!item.simulated && item.provider === "PAGA" && item.status === "PENDING" && <form action={reconcilePagaCompensation}><input type="hidden" name="obligationId" value={item.id} /><button className="button button-secondary button-small">{item.pagaTransfer ? "Reconcile Paga transfer" : "Start Paga transfer"}</button><span className="field-note">Retries use the same Paga reference.</span></form>}
      {item.simulated && ["PENDING", "FAILED"].includes(item.status) && <div className="finance-actions"><form action={simulateSettlement}><input type="hidden" name="obligationId" value={item.id} /><button className="button button-primary button-small">Record simulated settlement</button></form><form action={simulateFailure} className="inline-form"><input type="hidden" name="obligationId" value={item.id} /><label>Simulation note<input name="reason" required minLength={4} maxLength={300} defaultValue="Simulated provider failure for reconciliation." /></label><button className="button button-secondary button-small">Record simulated failure</button></form></div>}
      {item.simulated && ["PENDING", "FAILED"].includes(item.status) && <form action={adjustObligation} className="inline-form"><input type="hidden" name="obligationId" value={item.id} /><label>Adjusted amount<input type="number" name="newAmount" min="0" step="1" defaultValue={item.amount} required /></label><label>Reason<input name="reason" required minLength={8} maxLength={1000} /></label><button className="button button-secondary button-small">Record amount adjustment</button></form>}
      {item.simulated && item.status === "SIMULATED_PAID" && <form action={simulateRefund} className="inline-form"><input type="hidden" name="obligationId" value={item.id} /><label>Refund reason<input name="reason" required minLength={8} maxLength={1000} /></label><button className="button button-secondary button-small">Record simulated refund</button></form>}
      <ul className="review-history">{item.ledgerEntries.map((entry) => <li key={entry.id}><div><strong>{entry.kind.replaceAll("_", " ")}</strong><small>{entry.createdAt.toLocaleString("en-NG")} · {entry.providerEventId ?? "No provider event"}</small></div><span>{entry.currency} {entry.amount.toLocaleString("en-NG")}</span></li>)}</ul>
      </div></article>) : <p className="field-note">No compensation obligations recorded.</p>}</section>
    <p className="legal-note">Paga operations are restricted to Sandbox. Sandbox activity does not move real money. Transfers in Live remain disabled in the server adapter.</p>
  </main>;
}
