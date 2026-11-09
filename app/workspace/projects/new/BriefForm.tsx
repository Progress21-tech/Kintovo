"use client";

import { useActionState } from "react";
import { createProjectBrief } from "@/app/workspace/actions";

type OrganisationOption = { id: string; name: string };

export function BriefForm({ organisations }: { organisations: OrganisationOption[] }) {
  const [state, action, pending] = useActionState(createProjectBrief, {});
  return <form action={action} className="panel form-panel">
    <div className="form-section"><h2>Start with the outcome</h2><p>Tell us what you want to accomplish. This brief is saved as a draft so you can return and refine it.</p>
      <div className="field-grid">
        {organisations.length > 1 ? <label>Organisation<select name="organisationId">{organisations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label> : <input type="hidden" name="organisationId" value={organisations[0]?.id ?? ""} />}
        <label>Project title<input name="title" placeholder="e.g. Introduce our app to Nigerian students" minLength={4} maxLength={120} required /></label>
        <label className="span-two">What are you trying to achieve?<span className="field-note">Be specific about the change or result you want.</span><textarea name="objective" placeholder="We want to introduce our productivity app to university students and young professionals in Nigeria…" minLength={30} maxLength={5000} required /></label>
        <label>Target market<input name="targetMarket" defaultValue="Nigeria" required /></label>
        <label>Target audience<input name="targetAudience" placeholder="Who do you want to reach?" maxLength={600} /></label>
      </div>
    </div>
    <div className="form-section"><h2>Your starting point</h2><p>These details help people understand the context and constraints around the work.</p>
      <div className="field-grid">
        <label>Current market presence<textarea name="currentPresence" placeholder="What is already in place?" maxLength={1000} /></label>
        <label>Capabilities you already have<textarea name="currentCapabilities" placeholder="People, partners, tools, or skills available" maxLength={1000} /></label>
        <label>What have you tried so far?<textarea name="previousAttempts" placeholder="Optional" maxLength={1000} /></label>
        <label>Existing resources<textarea name="existingResources" placeholder="Assets, data, or partners you can share" maxLength={1000} /></label>
      </div>
    </div>
    <div className="form-section"><h2>Scope and timing</h2><p>Budget and timing are planning inputs. They do not create a payment obligation.</p>
      <div className="field-grid">
        <label>Minimum budget<input type="number" name="budgetMin" min="0" step="1" placeholder="Optional" /></label>
        <label>Maximum budget<input type="number" name="budgetMax" min="0" step="1" placeholder="Optional" /></label>
        <label>Currency<select name="currency" defaultValue="NGN"><option value="NGN">NGN · Nigerian naira</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · Pound sterling</option><option value="EUR">EUR · Euro</option></select></label>
        <label>Target deadline<input type="date" name="deadline" /></label>
        <label>How would you like to engage?<select name="path" defaultValue="UNDECIDED"><option value="UNDECIDED">Help me decide after planning</option><option value="TEAM">Assemble a project team</option><option value="INDIVIDUAL">Hire an individual specialist</option></select></label>
        <label>Expected outcomes<input name="expectedOutcomes" placeholder="How will you know this work succeeded?" maxLength={1000} /></label>
        <label className="span-two">Constraints or requirements<textarea name="constraints" placeholder="Timing, location, access, compliance, or other constraints" maxLength={1500} /></label>
        <label className="span-two">Anything else to know?<textarea name="additionalInformation" placeholder="Optional context" maxLength={1500} /></label>
      </div>
    </div>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}
    <div className="form-actions"><button className="button button-primary" disabled={pending}>{pending ? "Saving brief…" : "Save draft and review plan"}</button></div>
  </form>;
}
