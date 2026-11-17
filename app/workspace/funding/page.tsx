import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

function formatNgn(minor: bigint | null) {
  if (minor === null) return "Not synced";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(Number(minor) / 100);
}

export default async function FundingPage() {
  const user = await requireUser();
  const membership = await db.organisationMembership.findFirst({
    where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } },
    include: { organisation: { include: { pagaAccount: true } } },
  });
  if (!membership) redirect("/workspace");
  const account = membership.organisation.pagaAccount;
  const sandboxEnabled = process.env.PAGA_ENABLE_SANDBOX === "true";

  return <main className="app-main">
    <PageHeader
      eyebrow="Business finance"
      title="Add funds"
      description="Fund your organisation's NGN balance through its Paga subsidiary account."
      action={<span className={`status-pill ${account?.status === "ACTIVE" ? "blue" : "amber"}`}>{account?.status === "ACTIVE" ? "Paga Sandbox account active" : "Paga account pending"}</span>}
    />
    <section className="metric-grid earnings-metrics" aria-label="Funding account summary">
      <article className="metric"><span>Paga balance snapshot</span><strong>{formatNgn(account?.lastBalanceMinor ?? null)}</strong><small>{account?.lastBalanceSyncedAt ? `Last synced ${account.lastBalanceSyncedAt.toLocaleString("en-NG")}` : "Balance will appear after provider sync"}</small></article>
      <article className="metric"><span>Account currency</span><strong>NGN</strong><small>Paga subsidiary accounts hold naira only</small></article>
      <article className="metric"><span>Organisation</span><strong>{membership.organisation.name}</strong><small>Business account owner</small></article>
    </section>
    <section className="panel earnings-withdrawal">
      <div className="panel-header"><div><h2>Dedicated Paga account</h2><span className="field-note">Account creation is performed by Paga Sandbox when the server credentials and HTTPS callback are configured.</span></div><span className={`status-pill ${account?.status === "ACTIVE" ? "blue" : "amber"}`}>{account?.status ?? "Not requested"}</span></div>
      <div className="panel-content">
        {account?.status === "ACTIVE" && account.accountNumber ? <>
          <p><strong>Bank account number:</strong> <code>{account.accountNumber}</code></p>
          <p><strong>Account name:</strong> {membership.organisation.name}</p>
          <p>Send NGN to this account. Deposits are credited only after Paga's signed funding notification is verified and recorded.</p>
        </> : <>
          <p>{sandboxEnabled ? "Paga account provisioning is not complete yet." : "Paga Sandbox has not been enabled for this deployment. The account record is reserved and no provider request has been made."}</p>
          {account?.provisioningError && <p className="field-note">Setup detail: {account.provisioningError}</p>}
          <ul className="review-history">
            <li><div><strong>Paga Sandbox credentials</strong><small>Store the public, secret, and hash keys as Codespaces secrets</small></div><span>{sandboxEnabled ? "Configured" : "Pending"}</span></li>
            <li><div><strong>Public account callback</strong><small>HTTPS endpoint at /api/webhooks/paga/accounts</small></div><span>{process.env.PAGA_ACCOUNT_CALLBACK_URL ? "Configured" : "Pending"}</span></li>
            <li><div><strong>Account ledger</strong><small>Funding transactions are matched by Paga account number</small></div><span>Ready after migration</span></li>
          </ul>
        </>}
      </div>
    </section>
    <section className="panel">
      <div className="panel-header"><div><h2>Currency and settlement</h2><span className="field-note">This account is a real NGN subsidiary account, not a multi-currency wallet.</span></div></div>
      <div className="panel-content"><p>USD collection uses Paga's separate USD bank-transfer payment request flow and settles as NGN at Paga's exchange rate when the payment arrives. EUR and GBP collection are not enabled through this Paga integration. They must stay unavailable until a separate, approved provider flow is selected.</p></div>
    </section>
  </main>;
}
