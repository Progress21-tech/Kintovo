"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { requestTrustReview } from "./actions";

export function TrustForm({ profileType }: { profileType: "SPECIALIST" | "CREATOR" }) {
  const [state, action, pending] = useActionState(requestTrustReview, {});
  return <form action={action} className="form-stack trust-form">
    <input type="hidden" name="profileType" value={profileType} />
    <label>Review dimension<select name="dimension" defaultValue="PORTFOLIO_SKILLS"><option value="PORTFOLIO_SKILLS">Portfolio and authorship</option><option value="LOCAL_EXPERTISE">Local-market expertise</option></select></label>
    <label>Evidence link (optional)<input name="evidenceUrl" type="url" placeholder="https://example.com/evidence" /></label>
    <label>Evidence context<textarea name="evidenceNote" minLength={20} maxLength={1500} required placeholder="Explain what this evidence shows, your contribution, and anything a reviewer should verify." /></label>
    <p className="field-note">Do not submit identity documents or private credentials here. Secure identity verification is not enabled yet.</p>
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-primary" disabled={pending}>{pending ? "Submitting…" : "Request human review"}</button>
  </form>;
}
