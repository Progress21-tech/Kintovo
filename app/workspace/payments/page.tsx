import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { PageHeader } from "@/components/PageHeader";

export default async function PaymentsPage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, select: { organisationId: true } });
  const projects = memberships.length ? await db.project.findMany({ where: { organisationId: { in: memberships.map((item) => item.organisationId) } }, select: { id: true } }) : [];
  const accessibleProjectIds = projects.map((project) => project.id);
  const obligations = await db.compensationObligation.findMany({ where: { OR: [{ recipientId: user.id }, { createdById: user.id }, ...(accessibleProjectIds.length ? [{ projectId: { in: accessibleProjectIds } }] : [])] }, include: { ledgerEntries: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return <main className="app-main"><PageHeader eyebrow="Financial records" title="Payments" description="View payment obligations and ledger entries linked to approved work." action={<span className="status-pill amber">Simulated mode only</span>} />
    {obligations.length ? <div className="review-list">{obligations.map((item) => <article className="panel" key={item.id}><div className="panel-header"><div><h2>{item.reference}</h2><span className="field-note">{item.provider} · {item.simulated ? "Simulated record" : "Provider-confirmed record"}</span></div><span className={`status-pill ${item.status === "SIMULATED_PAID" || item.status === "PROVIDER_CONFIRMED_PAID" ? "green" : "amber"}`}>{item.status.replaceAll("_", " ")}</span></div><div className="panel-content"><p><strong>{item.currency} {item.amount.toLocaleString("en-NG")}</strong> · Created {item.createdAt.toLocaleDateString("en-NG")}{item.paidAt ? ` · Recorded paid ${item.paidAt.toLocaleDateString("en-NG")}` : ""}</p>{item.failureReason && <p className="field-note">Record note: {item.failureReason}</p>}<ul className="review-history">{item.ledgerEntries.map((entry) => <li key={entry.id}><div><strong>{entry.kind.replaceAll("_", " ")}</strong><small>{entry.createdAt.toLocaleString("en-NG")} · {entry.providerEventId ?? "No provider event ID"}</small></div><span>{entry.currency} {entry.amount.toLocaleString("en-NG")}</span></li>)}</ul></div></article>)}</div> : <section className="panel empty-state"><div><span className="empty-icon">◉</span><h3>No payment obligations</h3><p>Approved milestones create payment records for operations to reconcile. This ledger does not hold or release funds.</p></div></section>}
    <p className="legal-note">A simulated payment is a local record only. Provider integrations, custody, and conditional release are unavailable.</p></main>;
}
