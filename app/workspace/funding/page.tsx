import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function FundingPage() {
  const user = await requireUser();
  const membership = await db.organisationMembership.findFirst({
    where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } },
    include: { organisation: true },
  });
  if (!membership) redirect("/workspace");

  return <main className="app-main">
    <PageHeader
      eyebrow="Business finance"
      title="Add funds"
      description="Prepare a business funding account for project and campaign payments."
      action={<span className="status-pill amber">Provider setup pending</span>}
    />
    <section className="metric-grid earnings-metrics" aria-label="Funding account summary">
      <article className="metric"><span>Available balance</span><strong>—</strong><small>Provider balance will appear after activation</small></article>
      <article className="metric"><span>Funding currency</span><strong>NGN</strong><small>Nigeria-first payment flows</small></article>
      <article className="metric"><span>Organisation</span><strong>{membership.organisation.name}</strong><small>Business funding owner</small></article>
    </section>
    <section className="panel earnings-withdrawal">
      <div className="panel-header"><div><h2>Dedicated virtual account</h2><span className="field-note">Paystack Dedicated Virtual Accounts are not connected yet.</span></div><span className="status-pill amber">Unavailable</span></div>
      <div className="panel-content">
        <p>After Paystack approval and go-live, Kintovo can request a dedicated NGN account for this organisation. Bank transfers to that account can then be matched to the organisation through Paystack transaction webhooks.</p>
        <ul className="review-history">
          <li><div><strong>Business verification</strong><small>Required by the provider for eligible Nigerian businesses</small></div><span>Pending</span></li>
          <li><div><strong>Provider webhook</strong><small>Required before a transfer can credit the funding ledger</small></div><span>Pending</span></li>
          <li><div><strong>Funding ledger</strong><small>Must be reconciled before funds can be applied to engagements</small></div><span>Pending</span></li>
        </ul>
      </div>
    </section>
    <section className="panel">
      <div className="panel-header"><div><h2>What is supported today?</h2><span className="field-note">No money is held or moved by this screen.</span></div></div>
      <div className="panel-content"><p>Businesses can review simulated payment obligations in Payments. Live checkout, DVA funding, balance custody, refunds, and provider reconciliation require a Paystack account, approved business verification, server-side credentials, and a reviewed webhook integration.</p></div>
    </section>
  </main>;
}
