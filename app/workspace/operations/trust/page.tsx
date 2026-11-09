import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { decideTrustReview, publishProfessionalProfile } from "./actions";

export default async function TrustReviewPage() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN" && user.platformRole !== "OPERATIONS") redirect("/workspace");
  const [reviews, profiles] = await Promise.all([
    db.trustReview.findMany({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } }, include: { professional: { include: { user: { select: { name: true } }, portfolio: { where: { isPublic: false }, take: 6 } } }, creator: { include: { user: { select: { name: true } } } }, orderBy: { submittedAt: "asc" }, take: 100 }),
    db.professionalProfile.findMany({ where: { isPublished: false, onboardingCompletedAt: { not: null } }, include: { user: { select: { name: true } }, trustReviews: { where: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } }, orderBy: { onboardingCompletedAt: "asc" }, take: 100 }),
  ]);
  return <main className="app-main">
    <PageHeader eyebrow="Operations" title="Trust and profile review" description="Record a human decision for each submitted evidence dimension. Identity verification requires secure document handling and cannot be approved in this workflow." />
    <section className="review-list"><h2 className="section-subhead">Evidence requests</h2>{reviews.length ? reviews.map((review) => <article className="panel review-card" key={review.id}>
      <div className="panel-header"><div><h2>{review.professional?.user.name ?? review.creator?.user.name ?? "Profile"}</h2><span className="field-note">{review.dimension.replaceAll("_", " ")} · {review.status.replaceAll("_", " ")}</span></div></div>
      <div className="panel-content"><p className="review-objective">{review.evidenceNote}</p>{review.evidenceUrl && <p><a className="text-link" href={review.evidenceUrl} target="_blank" rel="noreferrer">Open evidence link</a></p>}
        {review.professional?.portfolio.map((item) => <p className="field-note" key={item.id}>{item.title} · private sample (visible to reviewers only here)</p>)}
        {review.dimension === "IDENTITY" ? <p className="form-alert">Identity review is unavailable until secure identity evidence storage is configured.</p> : <form action={decideTrustReview} className="review-decision-form"><input type="hidden" name="id" value={review.id} /><label>Reviewer note<textarea name="note" minLength={4} maxLength={1000} required /></label><div className="form-actions"><button className="button button-secondary" name="decision" value="REJECTED">Reject evidence</button><button className="button button-primary" name="decision" value="APPROVED">Approve this dimension</button></div></form>}
      </div>
    </article>) : <p className="field-note">No open trust-review requests.</p>}</section>
    <section className="review-list"><h2 className="section-subhead">Profiles eligible for publication review</h2>{profiles.length ? profiles.map((profile) => <article className="panel review-card" key={profile.id}><div className="panel-header"><div><h2>{profile.user.name} · {profile.headline ?? "Professional profile"}</h2><span className="field-note">{profile.categories.join(" · ")} · {profile.city ?? profile.country}</span></div></div><div className="panel-content"><p className="review-objective">{profile.biography}</p>{profile.trustReviews.length ? <form action={publishProfessionalProfile}><input type="hidden" name="profileId" value={profile.id} /><p className="field-note">Portfolio and authorship evidence has an approved review record. Publishing makes this profile discoverable; it does not assert identity verification.</p><button className="button button-primary">Publish profile to specialist discovery</button></form> : <p className="field-note">Approve at least one portfolio and authorship review dimension before publishing.</p>}</div></article>) : <p className="field-note">No completed profiles awaiting publication.</p>}</section>
  </main>;
}
