"use client";

import { useActionState } from "react";
import { acceptAgreement, acceptProposal, declineProposal, inviteShortlistedProfessional, submitProposal } from "./actions";

export type OfferValues = { id: string; amount: number; currency: string; scope: string; deliverables: string[]; assumptions: string[]; exclusions: string[]; revisionAllowance: number; usageRights: string | null; dependencies: string | null; expenses: string | null; deadline: Date | null; estimatedStartAt: Date | null; authorId: string; version: number; status: string };

export function InviteProfessionalForm({ projectId, profileId }: { projectId: string; profileId: string }) {
  return <details className="invite-details"><summary>Invite to this project</summary><form action={async (formData) => { await inviteShortlistedProfessional(formData); }} className="form-stack invite-details-content"><input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="profileId" value={profileId} /><label>Invitation note<textarea name="message" maxLength={1500} placeholder="Share why this opportunity may be relevant and what you would like the professional to review." /></label><button className="button button-primary button-small">Send project invitation</button></form></details>;
}

export function ProposalForm({ engagementId, previous }: { engagementId: string; previous?: OfferValues }) {
  const [state, action, pending] = useActionState(submitProposal, {});
  return <form action={action} className="form-stack proposal-form">
    <input type="hidden" name="engagementId" value={engagementId} />
    {previous && <input type="hidden" name="previousProposalId" value={previous.id} />}
    <label>Scope and approach<textarea name="scope" minLength={20} maxLength={5000} required defaultValue={previous?.scope ?? ""} /></label>
    <div className="field-grid"><label>Fee<input name="amount" type="number" min="0" step="1" required defaultValue={previous?.amount ?? ""} /></label><label>Currency<select name="currency" defaultValue={previous?.currency ?? "NGN"}><option>NGN</option><option>USD</option><option>GBP</option><option>EUR</option></select></label></div>
    <label>Deliverables, one per line<textarea name="deliverables" minLength={2} maxLength={3000} required defaultValue={previous?.deliverables.join("\n") ?? ""} /></label>
    <label>Assumptions, one per line<textarea name="assumptions" maxLength={2000} defaultValue={previous?.assumptions.join("\n") ?? ""} /></label>
    <label>Exclusions, one per line<textarea name="exclusions" maxLength={2000} defaultValue={previous?.exclusions.join("\n") ?? ""} /></label>
    <div className="field-grid"><label>Revision rounds<input name="revisionAllowance" type="number" min="0" max="10" required defaultValue={previous?.revisionAllowance ?? 1} /></label><label>Estimated start date<input name="estimatedStartAt" type="date" defaultValue={previous?.estimatedStartAt?.toISOString().slice(0, 10) ?? ""} /></label><label>Target deadline<input name="deadline" type="date" defaultValue={previous?.deadline?.toISOString().slice(0, 10) ?? ""} /></label></div>
    <label>Usage rights<textarea name="usageRights" maxLength={1200} defaultValue={previous?.usageRights ?? ""} placeholder="Describe the proposed usage or state that it needs further agreement." /></label>
    <div className="field-grid"><label>Dependencies<textarea name="dependencies" maxLength={1200} defaultValue={previous?.dependencies ?? ""} /></label><label>Expenses<textarea name="expenses" maxLength={1200} defaultValue={previous?.expenses ?? ""} placeholder="List any proposed expenses or write none." /></label></div>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}{state.success && <p className="form-success" role="status">{state.success}</p>}
    <button className="button button-primary" disabled={pending}>{pending ? "Sending…" : previous ? "Send counteroffer" : "Send proposal"}</button>
  </form>;
}

export function ProposalActions({ proposal }: { proposal: OfferValues }) {
  return <div className="proposal-actions">
    <form action={async (formData) => { await acceptProposal(formData); }}><input type="hidden" name="proposalId" value={proposal.id} /><button className="button button-primary button-small">Accept proposal and create agreement</button></form>
    <form action={declineProposal}><input type="hidden" name="proposalId" value={proposal.id} /><button className="button button-secondary button-small">Decline proposal</button></form>
  </div>;
}

export function AgreementAcceptanceForm({ agreementId }: { agreementId: string }) {
  return <form action={acceptAgreement} className="agreement-accept-form">
    <input type="hidden" name="agreementId" value={agreementId} />
    <label><input type="checkbox" name="acceptedTerms" required /> I have reviewed the agreement terms above and accept them on behalf of my account.</label>
    <button className="button button-primary button-small">Accept agreement</button>
  </form>;
}
