"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { submitEngagementRating } from "./rating-actions";

type Rating = { reviewerId: string; rating: number };
type Engagement = { id: string; status: string; professional: { user: { name: string } }; ratings: Rating[] };

function RatingForm({ engagementId, revieweeLabel }: { engagementId: string; revieweeLabel: string }) {
  const [state, action, pending] = useActionState(submitEngagementRating, {});
  return <form action={action} className="form-stack project-rating-form"><input type="hidden" name="engagementId" value={engagementId} /><label>Rate {revieweeLabel}<select name="rating" defaultValue="" required><option value="" disabled>Select a score</option><option value="5">5 · Excellent</option><option value="4">4 · Very good</option><option value="3">3 · Good</option><option value="2">2 · Needs improvement</option><option value="1">1 · Poor</option></select></label><label>Additional feedback (optional)<textarea name="comment" maxLength={1000} /></label><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit rating"}</button></form>;
}

export function ProjectRatings({ engagements, userId, isBusiness, businessName }: { engagements: Engagement[]; userId: string; isBusiness: boolean; businessName: string }) {
  const completed = engagements.filter((item) => item.status === "COMPLETED");
  return <section className="panel project-ratings-panel"><div className="panel-header"><div><h2>Project feedback</h2><span className="field-note">Both parties can leave one rating after an engagement is complete.</span></div></div><div className="panel-content"><div className="review-list">{completed.length ? completed.map((engagement) => {
    const existing = engagement.ratings.find((rating) => rating.reviewerId === userId);
    const label = isBusiness ? engagement.professional.user.name : businessName;
    return <article className="rating-row" key={engagement.id}><strong>{isBusiness ? `Rate ${label}` : `Rate your experience with ${label}`}</strong>{existing ? <p className="field-note">Your rating: {existing.rating}/5 · submitted</p> : <RatingForm engagementId={engagement.id} revieweeLabel={label} />}</article>;
  }) : <p className="field-note">Ratings appear after a project with a completed engagement is closed.</p>}</div></div></section>;
}
