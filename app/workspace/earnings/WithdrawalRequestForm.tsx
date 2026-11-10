"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { requestWithdrawal } from "./actions";

export function WithdrawalRequestForm({ currency, available }: { currency: string; available: number }) {
  const [state, action, pending] = useActionState(requestWithdrawal, {});
  return <form action={action} className="inline-form withdrawal-request-form"><input type="hidden" name="currency" value={currency} /><label>Amount to request ({currency})<input name="amount" type="number" min="1" max={available} step="1" required /></label><button className="button button-primary button-small" disabled={pending}>{pending ? "Sending…" : "Request withdrawal"}</button><FormStatus error={state.error} success={state.success} /><small className="field-note">24-hour review period. Simulated earnings cannot be transferred.</small></form>;
}
