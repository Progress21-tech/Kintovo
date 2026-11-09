import { requireUser } from "@/server/access";

export default async function PaymentsPage() {
  await requireUser();
  return <main className="app-main"><div className="page-title-row"><div><span className="welcome-label">Financial records</span><h1>Payments</h1><p>Track obligations and records against accepted work.</p></div><span className="status-pill amber">Simulated mode only</span></div><section className="panel empty-state"><div><span className="empty-icon">◉</span><h3>No payment obligations</h3><p>There are no project-linked payment obligations yet. Any local test record will be explicitly labelled as simulated; live fund holding and conditional release are unavailable.</p></div></section><p className="legal-note">Kintovo is not representing itself as a custodian or escrow provider. Paga and Busha are evaluation candidates only; approval for this marketplace flow has not been confirmed.</p></main>;
}
