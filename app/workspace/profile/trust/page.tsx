import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { TrustForm } from "./TrustForm";

export default async function TrustPage() {
  const user = await requireUser();
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, include: { trustReviews: { orderBy: { submittedAt: "desc" } } } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, include: { trustReviews: { orderBy: { submittedAt: "desc" } } } }),
  ]);
  const reviews = [...(specialist?.trustReviews ?? []), ...(creator?.trustReviews ?? [])].sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  return <main className="app-main">
    <PageHeader eyebrow="Trust and evidence" title="Review requests" description="Ask Kintovo to review portfolio authorship or Nigeria-market experience. Each dimension is recorded separately." action={<Link className="button button-secondary" href="/workspace/professional">Professional home</Link>} />
    {reviews.length > 0 && <Panel title="Your submitted evidence"><ul className="review-history">{reviews.map((review) => <li key={review.id}><div><strong>{review.dimension.replaceAll("_", " ")}</strong><small>{review.evidenceNote}</small><small>Submitted {review.submittedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}{review.reviewerNote ? ` · ${review.reviewerNote}` : ""}</small></div><span className={`status-pill ${review.status === "APPROVED" ? "green" : review.status === "REJECTED" ? "amber" : "blue"}`}>{review.status.replaceAll("_", " ")}</span></li>)}</ul></Panel>}
    <div className="trust-request-grid">{specialist && <Panel title="Specialist evidence"><div className="panel-content"><TrustForm profileType="SPECIALIST" /></div></Panel>}{creator && <Panel title="Creator evidence"><div className="panel-content"><TrustForm profileType="CREATOR" /></div></Panel>}</div>
    {!specialist && !creator && <Panel title="Start with a profile"><div className="panel-content"><p className="org-intro">Create a specialist or creator profile before requesting evidence review.</p><Link href="/workspace/profile" className="button button-primary">Open profile onboarding</Link></div></Panel>}
    <p className="field-note trust-limit">Identity-document collection and identity checks are not enabled. Never send government identifiers or private credentials through this form.</p>
  </main>;
}
