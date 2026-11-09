"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});
  return <form action={action} className="form-stack">
    <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
    {state.error && <p className="form-alert" role="alert">{state.error}</p>}
    {state.message && <p className="form-success" role="status">{state.message}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
  </form>;
}
