import Link from "next/link";
import { notFound } from "next/navigation";
import { submitBriefForReview } from "@/app/workspace/actions";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canManageProjects } from "@/server/permissions";
import { PlanEditor } from "./PlanEditor";

const statusLabels: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Submitted for review", IN_REVIEW: "In review", MATCHING: "Talent matching", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export default async function ProjectBriefPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const user = await requireUser();
  const { projectId } = await params;
  const { submitted } = await searchParams;
  const project = await db.project.findUnique({ where: { id: projectId }, include: { brief: true, workstreams: { orderBy: { createdAt: "asc" } }, organisation: { select: { name: true } } } });
  if (!project) notFound();
  const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: project.organisationId, userId: user.id } } });
  if (!membership) notFound();
  const canEdit = canManageProjects(membership.role) && project.status === "DRAFT";
  const brief = project.brief;
  if (!brief) notFound();
  const budget = brief.budgetMin !== null || brief.budgetMax !== null ? `${brief.currency} ${brief.budgetMin?.toLocaleString("en-NG") ?? "—"} – ${brief.budgetMax?.toLocaleString("en-NG") ?? "—"}` : "Not provided";
  return <main className="app-main">
    <div className="page-title-row"><div><Link className="text-link" href="/workspace/projects">← &nbsp; Project briefs</Link><h1>{project.title}</h1><p>{project.organisation.name} · {brief.targetMarket} · {project.path === "TEAM" ? "Team assembly" : project.path === "INDIVIDUAL" ? "Individual hire" : "Plan then decide"}</p></div><span className={`status-pill ${project.status === "SUBMITTED" ? "blue" : project.status === "ACTIVE" ? "green" : "coral"}`}>{statusLabels[project.status] ?? project.status}</span></div>
    {submitted === "1" && <p className="form-success" role="status" style={{ marginBottom: 18 }}>Your brief was submitted. The status is now visible to your organisation.</p>}
    <div className="dashboard-grid">
      <div>
        <section className="panel"><div className="panel-header"><h2>Business objective</h2><span className="mini-label">Saved brief</span></div><div className="panel-content"><p style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{brief.objective}</p><div className="field-grid"><div><span className="mini-label">Target audience</span><p>{brief.targetAudience || "Not provided"}</p></div><div><span className="mini-label">Budget range</span><p>{budget}</p></div><div><span className="mini-label">Deadline</span><p>{brief.deadline?.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) ?? "Not provided"}</p></div><div><span className="mini-label">Expected outcomes</span><p>{brief.expectedOutcomes || "Not provided"}</p></div></div></div></section>
        <section className="panel" style={{ marginTop: 16 }}><div className="panel-header"><div><h2>Suggested workstreams</h2><span className="field-note">Editable rule-based suggestions</span></div></div><PlanEditor projectId={project.id} streams={project.workstreams} /></section>
      </div>
      <aside>
        <section className="panel"><div className="panel-header"><h2>Next step</h2></div><div className="panel-content"><p style={{ marginTop: 0, color: "var(--muted)", fontSize: 12 }}>Review the objective and workstreams. Submit when the scope is ready for human review.</p>{project.status === "DRAFT" && canManageProjects(membership.role) ? <form action={submitBriefForReview}><input type="hidden" name="projectId" value={project.id} /><button className="button button-primary button-wide">Submit for human review</button></form> : <p className="field-note">{project.status === "DRAFT" ? "A project manager or organisation owner can submit this brief." : "Your brief is in the review workflow."}</p>}</div></section>
        <div className="aside-card" style={{ marginTop: 14 }}><h3>About these suggestions</h3><p>Workstreams come from transparent rules applied to your objective. They are not AI-generated hiring decisions. You can edit them before submission.</p></div>
      </aside>
    </div>
  </main>;
}
