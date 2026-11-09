import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { submitAssessment } from "@/app/workspace/operations/assessments/actions";

export default async function ProfessionalAssessmentsPage() {
  const user = await requireUser();
  const profile = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  const assessments = profile ? await db.skillsAssessment.findMany({ where: { professionalProfileId: profile.id }, orderBy: { createdAt: "desc" }, take: 100 }) : [];
  return <main className="app-main"><PageHeader eyebrow="Professional profile" title="Skills assessments" description="Complete work samples requested by operations and review your recorded outcomes." />
    {assessments.length ? <section className="review-list">{assessments.map((assessment) => <article className="panel" key={assessment.id}><div className="panel-header"><div><h2>{assessment.title}</h2><span className="field-note">{assessment.category} · {assessment.status.replaceAll("_", " ")}</span></div>{assessment.score !== null && <span className="status-pill">{assessment.score}/100</span>}</div><div className="panel-content"><p>{assessment.instructions}</p><p className="field-note">Skills: {assessment.requiredSkills.join(" · ")}</p>{assessment.reviewerNote && <p className="notice">Reviewer feedback: {assessment.reviewerNote}</p>}{assessment.status === "NOT_STARTED" && <form action={submitAssessment} className="form-stack"><input type="hidden" name="assessmentId" value={assessment.id} /><label>Evidence link<input type="url" name="submittedEvidenceUrl" required placeholder="https://…" /></label><button className="button button-primary button-small">Submit for review</button><small className="field-note">Only submit a link you are comfortable sharing with authorised reviewers. Private uploads are not enabled.</small></form>}{assessment.submittedEvidenceUrl && <p><a href={assessment.submittedEvidenceUrl} target="_blank" rel="noreferrer">Open submitted evidence</a></p>}</div></article>)}</section> : <section className="panel empty-state"><div><h2>No assigned assessments</h2><p>Operations will notify you if a practical assessment is requested for your profile.</p></div></section>}
  </main>;
}
