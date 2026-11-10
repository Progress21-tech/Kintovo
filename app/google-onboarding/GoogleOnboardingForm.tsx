"use client";

import { useActionState } from "react";
import { completeGoogleOnboarding } from "./actions";

export function GoogleOnboardingForm() {
  const [state, action, pending] = useActionState(completeGoogleOnboarding, {});
  return <form action={action} className="form-stack">
    <label>I’m joining as<select name="context" defaultValue="BUSINESS"><option value="BUSINESS">A business buyer</option><option value="SPECIALIST">A specialist</option><option value="CREATOR">A creator</option></select></label>
    <label>Organisation name<span className="field-note">Required for business accounts</span><input name="organisation" maxLength={120} /></label>
    <label>Website<input name="website" type="url" placeholder="https://example.com" /></label>
    <label>Industry<input name="industry" maxLength={120} /></label>
    <label>Business model<input name="model" maxLength={120} /></label>
    <label>Product or service<input name="product" maxLength={300} /></label>
    <label>Business location<input name="location" maxLength={120} /></label>
    <label>About your work<textarea name="biography" maxLength={3000} placeholder="For specialist or creator accounts" /></label>
    <label>Categories<input name="categories" placeholder="Brand design, research, food content" maxLength={1000} /></label>
    <label>Publishing platforms<input name="platforms" placeholder="For creator accounts, e.g. Instagram, YouTube" maxLength={500} /></label>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Setting up workspace…" : "Complete Google signup"}</button>
  </form>;
}
