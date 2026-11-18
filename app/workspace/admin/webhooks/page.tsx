import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { evaluatedProviders, getPaymentProvider } from "@/server/payment-providers";

export default async function WebhooksPage({ searchParams }: { searchParams: Promise<{ provider?: string; state?: string }> }) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN" && user.platformRole !== "FINANCE") redirect("/workspace");
  const query = await searchParams;
  const where = {
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.state === "unprocessed" ? { processedAt: null } : query.state === "processed" ? { processedAt: { not: null } } : {}),
  };
  const [events, providers, pagaEvents, unprocessed] = await Promise.all([
    db.paymentWebhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, take: 100 }),
    db.paymentWebhookEvent.groupBy({ by: ["provider"], _count: { _all: true } }),
    db.pagaAccountLedgerEntry.findMany({ where: { providerEventId: { not: null } }, select: { id: true, providerEventId: true, kind: true, direction: true, amountMinor: true, currency: true, createdAt: true, account: { select: { accountReference: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.paymentWebhookEvent.count({ where: { processedAt: null } }),
  ]);
  const statuses = evaluatedProviders.map((name) => { const adapter = getPaymentProvider(name); return { name, status: adapter.status() }; });
  return <main className="app-main">
    <PageHeader eyebrow="Admin console" title="Webhooks and providers" description="Signed provider events are stored once per provider event id with a payload hash. Unprocessed events need Finance reconciliation." action={<Link className="button button-secondary" href="/workspace/operations/finance">Finance operations</Link>} />
    <section className="panel"><div className="panel-header"><h2>Payment provider adapters</h2></div><div className="panel-content"><div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Provider</th><th scope="col">Status</th></tr></thead><tbody>{statuses.map((item) => <tr key={item.name}><th scope="row">{item.name}</th><td><span className={item.status.kind === "SANDBOX" ? "status-pill blue" : item.status.kind === "SIMULATED" ? "simulated-badge" : "status-pill amber"}>{item.status.label}</span></td></tr>)}</tbody></table></div>
      <p className="field-note" style={{ marginTop: 12 }}>No adapter is approved for live marketplace settlement, escrow, or custody of third-party funds. Paga and Busha remain technical candidates pending provider and legal approval.</p></div></section>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><h2>Received webhook events</h2><span className="field-note">{unprocessed} unprocessed</span></div></div><div className="panel-content">
      <form className="filter-bar" method="get"><label>Provider<select name="provider" defaultValue={query.provider ?? ""}><option value="">All</option>{providers.map((item) => <option key={item.provider} value={item.provider}>{item.provider} ({item._count._all})</option>)}</select></label><label>State<select name="state" defaultValue={query.state ?? ""}><option value="">All</option><option value="unprocessed">Unprocessed</option><option value="processed">Processed</option></select></label><button className="button button-primary button-small">Filter</button></form>
      {events.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Received</th><th scope="col">Provider</th><th scope="col">Event</th><th scope="col">Processing</th><th scope="col">Payload hash</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}>
        <td>{event.receivedAt.toLocaleString("en-NG")}</td><td>{event.provider}</td><th scope="row"><code>{event.eventType}</code><br /><code>{event.eventId}</code></th>
        <td>{event.processedAt ? <>{event.processedAt.toLocaleString("en-NG")}<br /><small className="field-note">{event.processingNote}</small></> : <span className="status-pill amber">Unprocessed</span>}</td><td><code>{event.payloadHash.slice(0, 16)}…</code></td>
      </tr>)}</tbody></table></div> : <p className="field-note">No webhook events match.</p>}
    </div></section>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><h2>Recent Paga Sandbox callback entries</h2></div><div className="panel-content">{pagaEvents.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th scope="col">Recorded</th><th scope="col">Account</th><th scope="col">Kind</th><th scope="col">Amount</th><th scope="col">Provider event</th></tr></thead><tbody>{pagaEvents.map((entry) => <tr key={entry.id}><td>{entry.createdAt.toLocaleString("en-NG")}</td><td><code>{entry.account.accountReference}</code></td><td>{entry.direction} · {entry.kind}</td><td>{entry.currency} {(Number(entry.amountMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</td><td><code>{entry.providerEventId}</code></td></tr>)}</tbody></table></div> : <p className="field-note">No Paga Sandbox callbacks have been recorded. Sandbox entries are test funds only.</p>}</div></section>
  </main>;
}
