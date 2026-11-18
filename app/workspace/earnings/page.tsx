import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { PagaAccountRetryForm, PagaBalanceRefreshForm, PagaBankDestinationForm } from "./PagaWalletSettings";
import { WithdrawalRequestForm } from "./WithdrawalRequestForm";

function formatNgn(minor: bigint | null) {
  if (minor === null) return "Not synced";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(minor) / 100);
}

export default async function EarningsPage() {
  const user = await requireUser();
  const [specialist, creator, obligations, withdrawals, pagaAccount, defaultBank] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.compensationObligation.findMany({ where: { recipientId: user.id }, include: { ledgerEntries: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.withdrawalRequest.findMany({ where: { userId: user.id }, include: { pagaBankDestination: { select: { bankName: true, accountNumberLast4: true } }, pagaPayout: { include: { bankDestination: { select: { bankName: true, accountNumberLast4: true } } } } }, orderBy: { requestedAt: "desc" }, take: 100 }),
    db.pagaAccount.findUnique({ where: { userId: user.id } }),
    db.pagaBankDestination.findFirst({ where: { userId: user.id, isDefault: true }, select: { bankName: true, accountHolderName: true, accountNumberLast4: true, validatedAt: true } }),
  ]);
  if (!specialist && !creator) redirect("/workspace");

  const reservedMinor = withdrawals.filter((request) => ["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(request.status) && request.currency === "NGN").reduce((sum, request) => sum + BigInt(request.amount) * BigInt(100), BigInt(0));
  const availableMinor = pagaAccount?.lastBalanceMinor === null || pagaAccount?.lastBalanceMinor === undefined
    ? null
    : (pagaAccount.lastBalanceMinor > reservedMinor ? pagaAccount.lastBalanceMinor - reservedMinor : BigInt(0));
  const activeAccount = pagaAccount?.status === "ACTIVE" && Boolean(pagaAccount.accountNumber);
  const availableWholeNgn = availableMinor === null ? 0 : Math.floor(Number(availableMinor) / 100);

  return <main className="app-main">
    <PageHeader eyebrow={creator ? "Creator earnings" : "Specialist earnings"} title="Wallet and payouts" description="View your NGN Paga account, link a validated bank destination, and request a reviewed withdrawal." action={<span className={`status-pill ${activeAccount ? "blue" : "amber"}`}>{activeAccount ? "Paga Sandbox account active" : "Paga account setup needed"}</span>} />
    <section className="metric-grid earnings-metrics" aria-label="Paga wallet summary">
      <article className="metric"><span>Paga NGN balance</span><strong>{formatNgn(pagaAccount?.lastBalanceMinor ?? null)}</strong><small>{pagaAccount?.lastBalanceSyncedAt ? `Last synced ${pagaAccount.lastBalanceSyncedAt.toLocaleString("en-NG")}` : "Refresh the balance from Paga"}</small></article>
      <article className="metric"><span>Available after reservations</span><strong>{availableMinor === null ? "—" : formatNgn(availableMinor)}</strong><small>Withdrawals are limited to the live Paga subsidiary-account balance</small></article>
      <article className="metric"><span>Bank destination</span><strong>{defaultBank ? `${defaultBank.bankName} ···· ${defaultBank.accountNumberLast4}` : "Not linked"}</strong><small>{defaultBank ? `Validated as ${defaultBank.accountHolderName}` : "Link and validate a Nigerian bank account"}</small></article>
    </section>

    <section className="panel earnings-withdrawal">
      <div className="panel-header"><div><h2>Your Paga NGN account</h2><span className="field-note">Paga subsidiary accounts hold NGN. This is the provider balance used to check withdrawal availability.</span></div><span className={`status-pill ${activeAccount ? "blue" : "amber"}`}>{pagaAccount?.status ?? "Not requested"}</span></div>
      <div className="panel-content">
        {activeAccount ? <>
          <p><strong>Paga account number:</strong> <code>{pagaAccount?.accountNumber}</code></p>
          <p><strong>Account name:</strong> {user.name}</p>
          <PagaBalanceRefreshForm />
        </> : <>
          {pagaAccount?.provisioningError && <p className="field-note">Setup detail: {pagaAccount.provisioningError}</p>}
          <p className="field-note">Your account is created by Paga Sandbox after the required server settings and callback are configured.</p>
          <PagaAccountRetryForm />
        </>}
      </div>
    </section>

    <section className="panel earnings-withdrawal">
      <div className="panel-header"><div><h2>Bank destination</h2><span className="field-note">Finance can send an approved withdrawal only to a bank account validated by Paga.</span></div>{defaultBank && <span className="status-pill green">Paga validated</span>}</div>
      {defaultBank && <div className="panel-content"><p><strong>{defaultBank.bankName}</strong> · account ending {defaultBank.accountNumberLast4}<br /><span className="field-note">Account holder: {defaultBank.accountHolderName} · validated {defaultBank.validatedAt.toLocaleDateString("en-NG")}</span></p></div>}
      <PagaBankDestinationForm active={activeAccount} />
    </section>

    <section className="panel earnings-withdrawal">
      <div className="panel-header"><div><h2>Request an NGN withdrawal</h2><span className="field-note">Finance reviews requests after a 24-hour hold. Approval starts a Paga transfer; the request remains reserved until Paga confirms settlement.</span></div><span className="status-pill amber">Finance approval required</span></div>
      <div className="panel-content">
        {!activeAccount ? <p className="field-note">Activate your Paga account before requesting a withdrawal.</p> : !defaultBank ? <p className="field-note">Link a validated bank account before requesting a withdrawal.</p> : availableWholeNgn > 0 ? <WithdrawalRequestForm currency="NGN" available={availableWholeNgn} /> : <p className="field-note">No available Paga balance to withdraw. Refresh your balance after funding the account.</p>}
      </div>
    </section>

    <section className="earnings-list"><h2 className="section-subhead">Withdrawal requests</h2>{withdrawals.length ? withdrawals.map((request) => <article className="panel earnings-row" key={request.id}>
      <div><strong>{request.currency} {request.amount.toLocaleString("en-NG")}</strong><small>Requested {request.requestedAt.toLocaleString("en-NG")} · review opens {request.reviewAfter.toLocaleString("en-NG")}</small>{request.pagaBankDestination && <small>Destination: {request.pagaBankDestination.bankName} ···· {request.pagaBankDestination.accountNumberLast4}</small>}{request.reviewNote && <small>{request.reviewNote}</small>}{request.pagaPayout?.payoutReference && <small>Paga reference {request.pagaPayout.payoutReference}{request.pagaPayout.payoutTransactionId ? ` · transaction ${request.pagaPayout.payoutTransactionId}` : ""}</small>}{request.pagaPayout?.failureReason && <small>{request.pagaPayout.failureReason}</small>}</div>
      <span className={`status-pill ${request.status === "PAID" ? "green" : request.status === "REJECTED" || request.status === "PAYOUT_FAILED" ? "amber" : "blue"}`}>{request.status.replaceAll("_", " ")}</span>
    </article>) : <p className="field-note">No withdrawal requests yet.</p>}</section>

    <section className="earnings-list"><h2 className="section-subhead">Compensation history</h2><p className="field-note">Compensation records and Paga wallet funds are shown separately. Simulated compensation is not part of your Paga cash balance.</p>{obligations.length ? obligations.map((obligation) => {
      const settled = obligation.ledgerEntries.filter((entry) => ["SIMULATED_SETTLEMENT", "PROVIDER_SETTLEMENT"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
      const refunded = obligation.ledgerEntries.filter((entry) => ["SIMULATED_REFUND", "PROVIDER_REFUND"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
      const settlementLabel = obligation.simulated ? "Simulated record" : obligation.status === "PROVIDER_CONFIRMED_PAID" ? "Paga-confirmed settlement" : "Awaiting Paga confirmation";
      return <article className="panel earnings-row" key={obligation.id}><div><strong>{obligation.reference}</strong><small>{obligation.provider} · {settlementLabel} · {obligation.createdAt.toLocaleDateString("en-NG")}</small></div><div><strong>{obligation.currency} {Math.max(0, settled - refunded || (obligation.status === "PENDING" ? obligation.amount : 0)).toLocaleString("en-NG")}</strong><span className={`status-pill ${obligation.status === "PROVIDER_CONFIRMED_PAID" ? "green" : obligation.simulated ? "amber" : "blue"}`}>{obligation.status.replaceAll("_", " ")}{obligation.simulated ? " · simulated" : ""}</span></div></article>;
    }) : <section className="panel empty-state"><div><h3>No earnings records yet</h3><p>Approved project compensation records will appear here.</p></div></section>}</section>
  </main>;
}
