"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { saveOrganisationSettings, savePersonalSettings, submitComplaint } from "./actions";

type Organisation = { id: string; name: string; website: string | null; industry: string | null; model: string | null; product: string | null; location: string | null; role: string };

function PersonalForm({ name, email, phone }: { name: string; email: string; phone: string | null }) {
  const [state, action, pending] = useActionState(savePersonalSettings, {});
  return <form action={action} className="form-stack"><div className="field-grid"><label>Full name<input name="name" defaultValue={name} minLength={2} maxLength={100} required /></label><label>Phone number<input name="phone" type="tel" defaultValue={phone ?? ""} maxLength={30} autoComplete="tel" /></label></div><label>Email address<input type="email" value={email} readOnly /><small className="field-note">Email changes require a separate verification flow and cannot be edited here.</small></label><FormStatus error={state.error} success={state.success} /><button className="button button-primary" disabled={pending}>{pending ? "Saving…" : "Save personal details"}</button></form>;
}

function OrganisationForm({ organisation }: { organisation: Organisation }) {
  const [state, action, pending] = useActionState(saveOrganisationSettings, {});
  const canEdit = ["OWNER", "ADMIN"].includes(organisation.role);
  return <section className="panel settings-organisation"><div className="panel-header"><div><h2>{organisation.name}</h2><span className="field-note">Business workspace · {organisation.role.toLowerCase().replaceAll("_", " ")}</span></div></div><div className="panel-content">{canEdit ? <form action={action} className="form-stack"><input type="hidden" name="organisationId" value={organisation.id} /><div className="field-grid"><label>Business name<input name="name" defaultValue={organisation.name} minLength={2} maxLength={120} required /></label><label>Website<input name="website" type="url" defaultValue={organisation.website ?? ""} /></label><label>Industry<input name="industry" defaultValue={organisation.industry ?? ""} maxLength={120} /></label><label>Business model<input name="model" defaultValue={organisation.model ?? ""} maxLength={120} /></label><label>Location<input name="location" defaultValue={organisation.location ?? ""} maxLength={120} /></label></div><label>Product or service<textarea name="product" defaultValue={organisation.product ?? ""} maxLength={300} /></label><FormStatus error={state.error} success={state.success} /><button className="button button-secondary" disabled={pending}>{pending ? "Saving…" : "Save business details"}</button></form> : <p className="field-note">Only an owner or administrator can edit business workspace details.</p>}</div></section>;
}

function ComplaintForm() {
  const [state, action, pending] = useActionState(submitComplaint, {});
  return <form action={action} className="form-stack"><div className="field-grid"><label>Category<select name="category" defaultValue="ACCOUNT"><option value="ACCOUNT">Account and profile</option><option value="PAYMENTS">Payments and earnings</option><option value="PROJECT">Project or campaign</option><option value="SAFETY">Safety or conduct</option><option value="OTHER">Other</option></select></label><label>Subject<input name="subject" minLength={5} maxLength={140} required /></label></div><label>What happened?<textarea name="description" minLength={20} maxLength={4000} required placeholder="Include the project or account context and what support you need." /></label><FormStatus error={state.error} success={state.success} /><button className="button button-primary" disabled={pending}>{pending ? "Sending…" : "Send complaint to Operations"}</button></form>;
}

export function SettingsForms({ user, organisations }: { user: { name: string; email: string; phone: string | null }; organisations: Organisation[] }) {
  return <>
    <section className="panel"><div className="panel-header"><div><h2>Personal information</h2><span className="field-note">Your name and contact details used by Kintovo.</span></div></div><div className="panel-content"><PersonalForm {...user} /></div></section>
    {organisations.length > 0 && <section className="review-list settings-organisations"><h2 className="section-subhead">Business workspaces</h2>{organisations.map((organisation) => <OrganisationForm key={organisation.id} organisation={organisation} />)}</section>}
    <section className="panel"><div className="panel-header"><div><h2>Contact Operations</h2><span className="field-note">Send an account complaint or request help. Project-specific delivery disputes belong in the project workspace.</span></div></div><div className="panel-content"><ComplaintForm /></div></section>
  </>;
}
