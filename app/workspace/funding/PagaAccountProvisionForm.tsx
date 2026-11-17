"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { retryPagaAccountProvisioning } from "./actions";

export function PagaAccountProvisionForm() {
  const [state, action, pending] = useActionState(retryPagaAccountProvisioning, {});
  return <form action={action} className="inline-form">
    <button className="button button-secondary" disabled={pending}>{pending ? "Checking Paga…" : "Create or retry Paga account"}</button>
    <FormStatus error={state.error} success={state.success} />
  </form>;
}
