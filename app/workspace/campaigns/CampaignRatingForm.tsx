"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { submitCampaignRating } from "./actions";

export function CampaignRatingForm({ campaignCreatorId, revieweeLabel, existingRating }: { campaignCreatorId: string; revieweeLabel: string; existingRating?: number }) {
  const [state, action, pending] = useActionState(submitCampaignRating, {});
  if (existingRating) return <p className="field-note">Your rating: {existingRating}/5 · submitted</p>;
  return <form action={action} className="form-stack project-rating-form"><input type="hidden" name="campaignCreatorId" value={campaignCreatorId} /><label>Rate {revieweeLabel}<select name="rating" defaultValue="" required><option value="" disabled>Select a score</option><option value="5">5 · Excellent</option><option value="4">4 · Very good</option><option value="3">3 · Good</option><option value="2">2 · Needs improvement</option><option value="1">1 · Poor</option></select></label><label>Additional feedback (optional)<textarea name="comment" maxLength={1000} /></label><FormStatus error={state.error} success={state.success} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Submitting…" : "Submit campaign rating"}</button></form>;
}
