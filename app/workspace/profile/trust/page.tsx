import Link from "next/link";
import { FileList } from "@/components/FileList";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { AppealForm, TrustForm } from "./TrustForm";

const dimensionLabels: Record<string, string> = { PORTFOLIO_SKILLS: "Portfolio and authorship", LOCAL_EXPERTISE: "Local-market expertise", IDENTITY: "Identity verification" };
const fileSelect = { where: { deletedAt: null }, select: { id: true, originalName: true, sizeBytes: true } } as const;

export default async function TrustPage() {
  const user = await requireUser();
  const [specialist, creator, appeals] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, include: { trustReviews: { include: { files: fileSelect }, orderBy: { submittedAt: "desc" } }, assessments: { where: { status: { in: ["APPROVED", "REJECTED"] } }, select: { id: true, title: true, status: true } } } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, include: { trustReviews: { include: { files: fileSelect }, orderBy: { submittedAt: "desc" } } } }),
    db.trustAppeal.findMany({ where: { userId: user.id }, include: { trustReview: { select: { dimension: true } }, assessment: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const reviews = [...(specialist?.trustReviews ?? []), ...(creator?.trustReviews ?? [])].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  const appealTargets = [
    ...reviews.filter((review) => ["APPROVED", "REJECTED"].includes(review.status)).map((review) => ({ value: `review:${review.id}`, label: `${dimensionLabels[review.dimension]} · ${review.status.toLowerCase()} ${review.reviewedAt?.toLocaleDateString("en-NG") ?? ""}`, rejected: review.status === "REJECTED" })),
    ...(specialist?.assessments ?? []).map((item) => ({ value: `assessment:${item.id}`, label: `Assessment: ${item.title} · ${item.status.toLowerCase()}`, rejected: item.status === "REJECTED" })),
  ];
  return <main className="app-main">
    <PageHeader eyebrow="Trust and evidence" title="Review requests" description="Each trust dimension is reviewed and recorded separately by a person. No single badge implies that every dimension has been checked." action={<Link className="button button-secondary" href="/workspace/professional">Professional home</Link>} />
    {reviews.length > 0 && <Panel title="Your submitted evidence"><ul className="review-history">{reviews.map((review) => <li key={review.id}><div><strong>{dimensionLabels[review.dimension]}</strong><small>{review.evidenceNote}</small><FileList files={review.files} label="Your evidence files" /><small>Submitted {review.submittedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}{review.reviewerNote ? ` · Reviewer: ${review.reviewerNote}` : ""}</small></div><span className={`status-pill ${review.status === "APPROVED" ? "green" : review.status === "REJECTED" ? "amber" : "blue"}`}>{review.status.replaceAll("_", " ")}</span></li>)}</ul></Panel>}
    <div className="trust-request-grid">{specialist && <Panel title="Specialist evidence"><div className="panel-content"><TrustForm profileType="SPECIALIST" /></div></Panel>}{creator && <Panel title="Creator evidence"><div className="panel-content"><TrustForm profileType="CREATOR" /></div></Panel>}</div>
    {(specialist || creator) && <div id="appeals" style={{ marginTop: 16 }}><Panel title="Appeals and corrections"><div className="panel-content">
      <p className="field-note">You can appeal a rejected decision or ask us to correct inaccurate information. A person reviews every request; decisions are never automated.</p>
      <AppealForm targets={appealTargets} />
      {appeals.length > 0 && <ul className="review-history" style={{ marginTop: 16 }}>{appeals.map((appeal) => <li key={appeal.id}><div><strong>{appeal.kind === "APPEAL" ? "Appeal" : "Correction"} · {appeal.trustReview ? dimensionLabels[appeal.trustReview.dimension] : appeal.assessment?.title ?? "Record"}</strong><small>{appeal.reason}</small>{appeal.staffNote && <small>Operations: {appeal.staffNote}</small>}</div><span className={`status-pill ${appeal.status === "UPHELD" ? "green" : appeal.status === "REJECTED" ? "amber" : "blue"}`}>{appeal.status.replaceAll("_", " ")}</span></li>)}</ul>}
    </div></Panel></div>}
    {!specialist && !creator && <Panel title="Start with a profile"><div className="panel-content"><p className="org-intro">Create a specialist or creator profile before requesting evidence review.</p><Link href="/workspace/profile" className="button button-primary">Open profile onboarding</Link></div></Panel>}
  </main>;
}
