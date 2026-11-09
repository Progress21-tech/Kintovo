import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { reviewBrief } from "../actions";

export default async function BriefReviewPage({ searchParams }: { searchParams: Promise<{ reviewed?: string }> }) {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN" && user.platformRole !== "OPERATIONS") redirect("/workspace");
  const { reviewed } = await searchParams;
  const projects = await db.project.findMany({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } }, include: { brief: true, organisation: { select: { name: true } }, workstreams: true }, orderBy: { updatedAt: "asc" }, take: 50 });
  return <main className="app-main">
    <PageHeader eyebrow="Operations" title="Brief review" description="Review the buyer-approved scope before the brief moves into curated matching." />
    {reviewed && <p className="form-success" role="status">The brief review was recorded.</p>}
    {projects.length ? <div className="review-list">{projects.map((project) => <section className="panel review-card" key={project.id}>
      <div className="panel-header"><div><h2>{project.title}</h2><span className="field-note">{project.organisation.name} · {project.status.replaceAll("_", " ")}</span></div><Link className="text-link" href={`/workspace/projects/${project.id}`}>Open brief</Link></div>
      <div className="panel-content"><p className="review-objective">{project.brief?.objective}</p><div className="talent-tags">{project.workstreams.flatMap((stream) => stream.recommendedRoles).slice(0, 8).map((role, index) => <span className="chip" key={`${role}-${index}`}>{role}</span>)}</div><form action={reviewBrief} className="review-decision-form"><input type="hidden" name="projectId" value={project.id} /><label>Review note<textarea name="note" minLength={4} maxLength={1000} required placeholder="Record what was reviewed and what should happen next." /></label><div className="form-actions"><button className="button button-secondary" name="decision" value="RETURN">Return for edits</button><button className="button button-primary" name="decision" value="MATCH">Move to matching</button></div></form></div>
    </section>)}</div> : <section className="panel empty-state"><div><span className="empty-icon">✓</span><h3>No briefs awaiting review</h3><p>Submitted project briefs will appear here for an authorised operations reviewer.</p></div></section>}
  </main>;
}
