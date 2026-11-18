"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { FileInput } from "@/components/FileList";
import { requestTrustReview, submitTrustAppeal } from "./actions";

export function TrustForm({ profileType }: { profileType: "SPECIALIST" | "CREATOR" }) {
  const [state, action, pending] = useActionState(requestTrustReview, {});
  const [dimension, setDimension] = useState("PORTFOLIO_SKILLS");
  const identity = dimension === "IDENTITY";
  return <form action={action} className="form-stack trust-form">
    <input type="hidden" name="profileType" value={profileType} />
    <label>Review dimension<select name="dimension" value={dimension} onChange={(event) => setDimension(event.target.value)}><option value="PORTFOLIO_SKILLS">Portfolio and authorship</option><option value="LOCAL_EXPERTISE">Local-market expertise</option><option value="IDENTITY">Identity verification</option></select></label>
    {!identity && <label>Evidence link (optional)<input name="evidenceUrl" type="url" placeholder="https://example.com/evidence" /></label>}
    <FileInput label={identity ? "Identity document (PDF or image, required)" : "Evidence file (optional)"} />
    <label>{identity ? "Document description" : "Evidence context"}<textarea name="evidenceNote" minLength={20} maxLength={1500} required placeholder={identity ? "State the document type and the name on it. Do not type identification numbers here." : "Explain what this evidence shows, your contribution, and anything a reviewer should verify."} /></label>
    {identity
      ? <p className="field-note">Identity documents are stored privately. Only Kintovo Admins can open them, and every access is logged. They are never shown to businesses or other users.</p>
      : <p className="field-note">Use the Identity verification option for identity documents. Never put identification numbers or private credentials in this form.</p>}
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-primary" disabled={pending}>{pending ? "Submitting…" : "Request human review"}</button>
  </form>;
}

export function AppealForm({ targets }: { targets: { value: string; label: string; rejected: boolean }[] }) {
  const [state, action, pending] = useActionState(submitTrustAppeal, {});
  const [kind, setKind] = useState("APPEAL");
  const options = kind === "APPEAL" ? targets.filter((item) => item.rejected) : targets;
  return <form action={action} className="form-stack">
    <label>Request type<select name="kind" value={kind} onChange={(event) => setKind(event.target.value)}><option value="APPEAL">Appeal a rejected decision</option><option value="CORRECTION">Correct inaccurate information</option></select></label>
    <label>Record<select name="target" required>{options.length ? options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>) : <option value="">No eligible records</option>}</select></label>
    <label>Explanation<textarea name="reason" minLength={30} maxLength={3000} required placeholder="What is inaccurate, or why the decision should be reconsidered. Add any new evidence through a new review request." /></label>
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-secondary" disabled={pending || !options.length}>{pending ? "Submitting…" : "Submit for human review"}</button>
  </form>;
}
