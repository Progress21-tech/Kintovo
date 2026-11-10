"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptCurrentPolicies } from "./actions";

export function PolicyAcceptanceForm() {
  const [state, action, pending] = useActionState(acceptCurrentPolicies, {});
  return <form action={action} className="form-stack policy-acceptance-form">
    <label className="legal-consent"><input type="checkbox" name="acceptTerms" required /><span>I agree to the current <Link href="/terms" target="_blank">Terms of Service</Link>.</span></label>
    <label className="legal-consent"><input type="checkbox" name="acceptPrivacy" required /><span>I acknowledge the current <Link href="/privacy" target="_blank">Privacy Notice</Link>.</span></label>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Saving agreement…" : "Accept and continue"}</button>
  </form>;
}
