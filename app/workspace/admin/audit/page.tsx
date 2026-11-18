import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string; entityType?: string; entityId?: string; actor?: string; from?: string; to?: string; page?: string }> }) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const query = await searchParams;
  const page = Math.max(1, Math.min(200, Number(query.page) || 1));
  const where: Prisma.AuditLogWhereInput = {};
  if (query.action?.trim()) where.action = { contains: query.action.trim().toUpperCase() };
  if (query.entityType?.trim()) where.entityType = query.entityType.trim();
  if (query.entityId?.trim()) where.entityId = query.entityId.trim();
  if (query.actor?.trim()) where.actor = { email: { contains: query.actor.trim().toLowerCase() } };
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) where.createdAt = { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) };
  const [entries, total, entityTypes] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: { select: { name: true, email: true, platformRole: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["entityType"], _count: { _all: true }, orderBy: { entityType: "asc" } }),
  ]);
  const params = (next: number) => { const p = new URLSearchParams(Object.entries(query).filter(([key, value]) => key !== "page" && value) as [string, string][]); p.set("page", String(next)); return `?${p.toString()}`; };
  return <main className="app-main">
    <PageHeader eyebrow="Admin console" title="Audit log" description={`${total.toLocaleString("en-NG")} matching records. Audit records are append-only and cannot be edited from the product.`} action={<Link className="button button-secondary" href="/workspace/admin">Admin overview</Link>} />
    <form className="panel filter-bar" style={{ padding: 16 }} method="get">
      <label>Action contains<input name="action" defaultValue={query.action} placeholder="MILESTONE_APPROVED" /></label>
      <label>Entity type<select name="entityType" defaultValue={query.entityType ?? ""}><option value="">Any</option>{entityTypes.map((item) => <option key={item.entityType} value={item.entityType}>{item.entityType} ({item._count._all})</option>)}</select></label>
      <label>Entity id<input name="entityId" defaultValue={query.entityId} /></label>
      <label>Actor email<input name="actor" defaultValue={query.actor} /></label>
      <label>From<input type="date" name="from" defaultValue={query.from} /></label>
      <label>To<input type="date" name="to" defaultValue={query.to} /></label>
      <button className="button button-primary button-small">Filter</button>
    </form>
    <section className="panel" style={{ marginTop: 16 }}><div className="panel-content">{entries.length ? <div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Details</th></tr></thead>
      <tbody>{entries.map((entry) => <tr key={entry.id}>
        <td>{entry.createdAt.toLocaleString("en-NG")}</td>
        <td>{entry.actor ? <>{entry.actor.name}<br /><small className="field-note">{entry.actor.email} · {entry.actor.platformRole}</small></> : <small className="field-note">System / provider</small>}</td>
        <th scope="row"><code>{entry.action}</code></th>
        <td><Link className="text-link" href={`?entityType=${encodeURIComponent(entry.entityType)}&entityId=${encodeURIComponent(entry.entityId)}`}>{entry.entityType}</Link><br /><code>{entry.entityId}</code></td>
        <td>{entry.metadata ? <code>{JSON.stringify(entry.metadata).slice(0, 240)}</code> : "—"}</td>
      </tr>)}</tbody>
    </table></div> : <div className="empty-state"><div><h3>No audit records match</h3><p>Adjust the filters above.</p></div></div>}
    <nav className="inline-form" aria-label="Audit log pages" style={{ marginTop: 12 }}>{page > 1 && <Link className="button button-secondary button-small" href={params(page - 1)}>Previous</Link>}<span className="field-note">Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>{page * PAGE_SIZE < total && <Link className="button button-secondary button-small" href={params(page + 1)}>Next</Link>}</nav>
    </div></section>
  </main>;
}
