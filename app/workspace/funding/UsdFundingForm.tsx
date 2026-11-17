"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { createUsdFundingRequest } from "./actions";

export function UsdFundingForm() {
  const [state, action, pending] = useActionState(createUsdFundingRequest, {});
  return <form action={action} className="inline-form withdrawal-request-form">
    <label>NGN balance to request<input name="amountNgn" type="number" min="1000" max="1000000000" step="1" required /></label>
    <label>Payer phone with country code<input name="payerPhoneNumber" type="tel" placeholder="+19175247723" pattern="\+[1-9][0-9]{7,14}" required /></label>
    <button className="button button-primary" disabled={pending}>{pending ? "Requesting from Paga…" : "Get USD bank instructions"}</button>
    <FormStatus error={state.error} success={state.success} />
    <small className="field-note">Paga quotes the exact USD transfer amount for each supported rail. Final NGN conversion is set when the payment arrives.</small>
  </form>;
}
