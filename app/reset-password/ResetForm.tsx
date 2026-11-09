"use client";

import { useActionState } from "react";
import { resetPassword } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, {});
  return <form action={action} className="form-stack">
    <input type="hidden" name="token" value={token} />
    <label>New password <span className="field-note">At least 12 characters</span><input type="password" name="password" autoComplete="new-password" minLength={12} required /></label>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Updating…" : "Set new password"}</button>
  </form>;
}
