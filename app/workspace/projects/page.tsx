import Link from "next/link";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function ProjectsPage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, select: { organisationId: true } });
  const projects = memberships.length ? await db.project.findMany({ where: { organisationId: { in: memberships.map((m) => m.organisationId) } }, include: { brief: true }, orderBy: { updatedAt: "desc" } }) : [];
  return <main className="app-main"><div className="page-title-row"><div><span className="welcome-label">Business workspace</span><h1>Project briefs</h1><p>Save an objective, refine its scope, and submit it for human review.</p></div><Link className="button button-primary" href="/workspace/projects/new">+ &nbsp; Start with a goal</Link></div><section className="panel">{projects.length ? <div className="panel-content project-list">{projects.map((project) => <Link className="project-row" key={project.id} href={`/workspace/projects/${project.id}`}><div><strong>{project.title}</strong><small>{project.brief?.targetMarket ?? "Nigeria"} · {project.updatedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></div><span className="field-note">{project.path === "TEAM" ? "Team assembly" : project.path === "INDIVIDUAL" ? "Individual hire" : "Plan first"}</span><span className="status-pill">{project.status.replaceAll("_", " ")}</span></Link>)}</div> : <div className="empty-state"><div><span className="empty-icon">＋</span><h3>No project briefs yet</h3><p>Start by describing the outcome you want to achieve.</p><Link className="button button-primary" href="/workspace/projects/new">Create your first brief</Link></div></div>}</section></main>;
}
