"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { createOrganisation, inviteOrganisationMember } from "./actions";

export function CreateOrganisationForm() {
  const [state, action, pending] = useActionState(createOrganisation, {});
  return <form action={action} className="form-stack">
    <label>Organisation name<input name="name" required minLength={2} maxLength={120} autoComplete="organization" /></label>
    <label>Website<input name="website" type="url" placeholder="https://example.com" /></label>
    <div className="field-grid">
      <label>Industry<input name="industry" maxLength={120} /></label>
      <label>Business model<input name="model" maxLength={120} /></label>
    </div>
    <label>Product or service<input name="product" maxLength={300} /></label>
    <label>Business location<input name="location" placeholder="City, country" maxLength={120} /></label>
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-primary" disabled={pending}>{pending ? "Creating…" : "Create organisation"}</button>
  </form>;
}

export function InviteMemberForm({ organisationId, actorRole }: { organisationId: string; actorRole: "OWNER" | "ADMIN" | "PROJECT_MANAGER" | "MEMBER" }) {
  const [state, action, pending] = useActionState(inviteOrganisationMember, {});
  return <form action={action} className="form-stack invite-form">
    <input type="hidden" name="organisationId" value={organisationId} />
    <label>Member email<input name="email" type="email" autoComplete="email" required /></label>
    <div className="field-grid">
      <label>Organisation role<select name="role" defaultValue="MEMBER">{actorRole === "OWNER" && <option value="OWNER">Owner</option>}<option value="ADMIN">Administrator</option><option value="PROJECT_MANAGER">Project manager</option><option value="MEMBER">Team member</option></select></label>
      <label>Spend approval<select name="canApproveSpend" defaultValue="false"><option value="false">No financial approval</option><option value="true">May approve spend</option></select></label>
    </div>
    <p className="field-note">Owners and administrators can invite people. Only an owner can appoint another owner.</p>
    <FormStatus error={state.error} success={state.success} />
    <button className="button button-secondary" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
  </form>;
}
