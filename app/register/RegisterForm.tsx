"use client";

import { useActionState } from "react";
import { useState } from "react";
import { registerAccount } from "./actions";
import { signIn } from "next-auth/react";

export function RegisterForm({ initialContext = "BUSINESS", googleConfigured = false }: { initialContext?: "BUSINESS" | "SPECIALIST" | "CREATOR"; googleConfigured?: boolean }) {
  const [state, action, pending] = useActionState(registerAccount, {});
  const [context, setContext] = useState(initialContext);
  return (
    <form action={action} className="form-stack">
      <label>Full name<input name="name" autoComplete="name" required minLength={2} /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password <span className="field-note">At least 12 characters</span><input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label>I’m joining as
        <select name="context" value={context} onChange={(event) => setContext(event.target.value as typeof initialContext)}>
          <option value="BUSINESS">A business buyer</option>
          <option value="SPECIALIST">A specialist</option>
          <option value="CREATOR">A creator</option>
        </select>
      </label>
      {context === "BUSINESS" && <>
        <label>Organisation name<input name="organisation" autoComplete="organization" required maxLength={120} /></label>
        <label>Website<input name="website" type="url" placeholder="https://example.com" autoComplete="url" /></label>
        <label>Industry<input name="industry" placeholder="e.g. Digital products" maxLength={120} /></label>
        <label>Business model<input name="model" placeholder="e.g. Subscription software" maxLength={120} /></label>
        <label>Product or service<input name="product" placeholder="What do you offer?" maxLength={300} /></label>
        <label>Business location<input name="location" placeholder="City, country" maxLength={120} /></label>
      </>}
      {state.error && <p className="form-alert" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
      <button className="button button-primary button-wide" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      {googleConfigured && <><div className="auth-divider"><span>or</span></div><button className="button button-secondary button-wide" type="button" onClick={() => signIn("google", { callbackUrl: "/google-onboarding" })}>Continue with Google</button></>}
      <p className="field-note">By creating an account you acknowledge that the Terms and Privacy pages are draft documents awaiting legal review.</p>
    </form>
  );
}
