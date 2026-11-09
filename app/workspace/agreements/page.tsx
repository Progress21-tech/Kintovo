import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function AgreementsPage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, select: { organisationId: true } });
  const projects = memberships.length ? await db.project.findMany({ where: { organisationId: { in: memberships.map((m) => m.organisationId) } }, select: { id: true } }) : [];
  const agreements = projects.length ? await db.agreement.findMany({ where: { engagement: { projectId: { in: projects.map((p) => p.id) } } }, include: { terms: true, engagement: { include: { project: { select: { title: true } } } } }, orderBy: { createdAt: "desc" } }) : [];
  return <main className="app-main"><div className="page-title-row"><div><span className="welcome-label">Commercial records</span><h1>Agreements</h1><p>Agreement terms and accepted versions belong to each engagement.</p></div></div><section className="panel">{agreements.length ? <div className="panel-content project-list">{agreements.map((agreement) => <div className="project-row" key={agreement.id}><div><strong>{agreement.engagement.project.title}</strong><small>Version {agreement.version} · {agreement.terms!.currency} {agreement.terms!.amount.toLocaleString("en-NG")}</small></div><span className="field-note">{agreement.terms!.deliverables.join(" · ")}</span><span className="status-pill">{agreement.status.replaceAll("_", " ")}</span></div>)}</div> : <div className="empty-state"><div><span className="empty-icon">↔</span><h3>No agreements yet</h3><p>When a brief becomes an engagement, proposals and accepted agreement versions will be listed here.</p></div></div>}</section></main>;
}
