import Link from "next/link";
import { BriefcaseBusiness, CircleDollarSign, UsersRound } from "lucide-react";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

const statusClass: Record<string, string> = { DRAFT: "", SUBMITTED: "blue", IN_REVIEW: "amber", MATCHING: "coral", ACTIVE: "green", COMPLETED: "green", CANCELLED: "" };

export default async function WorkspacePage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, include: { organisation: true }, orderBy: { createdAt: "asc" } });
  const organisationIds = memberships.map((item) => item.organisationId);
  const [projects, specialist, creator] = await Promise.all([
    organisationIds.length ? db.project.findMany({ where: { organisationId: { in: organisationIds } }, include: { brief: true }, orderBy: { updatedAt: "desc" }, take: 6 }) : Promise.resolve([]),
    db.professionalProfile.findUnique({ where: { userId: user.id } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const draftCount = projects.filter((project) => project.status === "DRAFT").length;
  const reviewCount = projects.filter((project) => project.status === "SUBMITTED" || project.status === "IN_REVIEW").length;
  const activeCount = projects.filter((project) => project.status === "ACTIVE" || project.status === "MATCHING").length;

  return <main className="app-main">
    <div className="page-title-row"><div><span className="welcome-label">Your workspace · Nigeria first</span><h1>Good to see you, {user.name.split(" ")[0]}.</h1><p>Keep your project goals and next steps in view.</p></div>{memberships.length > 0 && <Link className="button button-primary" href="/workspace/projects/new">+ &nbsp; Start with a goal</Link>}</div>
    {!memberships.length && <div className="panel empty-state"><div><span className="empty-icon">✳</span><h3>{specialist || creator ? "Build your professional presence" : "Set up your business workspace"}</h3><p>{specialist || creator ? "Your account is ready. Finish your profile details before it can be reviewed for the curated network." : "Create an organisation to start a project brief and invite your team."}</p><Link className="button button-primary" href="/workspace/profile">Continue setup</Link></div></div>}
    {memberships.length > 0 && <>
      <div className="metric-grid"><div className="metric"><span>Draft briefs</span><strong>{draftCount}</strong></div><div className="metric"><span>For review</span><strong>{reviewCount}</strong></div><div className="metric"><span>Active work</span><strong>{activeCount}</strong></div></div>
      <div className="dashboard-grid">
        <section className="panel"><div className="panel-header"><h2>Recent project briefs</h2><Link className="text-link" href="/workspace/projects">View all</Link></div>
          {projects.length ? <div className="panel-content project-list">{projects.map((project) => <Link className="project-row" key={project.id} href={`/workspace/projects/${project.id}`}><div><strong>{project.title}</strong><small>{project.brief?.targetMarket ?? "Nigeria"} · Updated {project.updatedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</small></div><span className="field-note">{project.path === "TEAM" ? "Team assembly" : project.path === "INDIVIDUAL" ? "Individual" : "Plan first"}</span><span className={`status-pill ${statusClass[project.status] ?? ""}`}>{project.status.replaceAll("_", " ")}</span></Link>)}</div> : <div className="empty-state"><div><span className="empty-icon"><BriefcaseBusiness size={17} /></span><h3>Your first project starts with a goal</h3><p>Share the outcome you want to reach. Kintovo will suggest the capabilities that may help.</p><Link className="button button-primary" href="/workspace/projects/new">Create a project brief</Link></div></div>}
        </section>
        <section className="panel"><div className="panel-header"><h2>Helpful next steps</h2></div><div className="panel-content action-list"><div className="action-item"><span className="action-dot" /><div><strong>Write the objective first</strong><span>Describe the outcome before selecting roles.</span></div></div><div className="action-item"><UsersRound size={15} color="#68716c" /><div><strong>Review suggested workstreams</strong><span>Suggestions are editable and need your approval.</span></div></div><div className="action-item"><CircleDollarSign size={15} color="#68716c" /><div><strong>Keep commercial terms clear</strong><span>Agreements govern scope, fee, and reviews.</span></div></div></div></section>
      </div>
    </>}
  </main>;
}
