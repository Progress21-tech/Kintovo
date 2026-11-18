"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/FormStatus";
import { verifyUsdFundingRequest } from "./actions";

export function UsdFundingVerificationForm({ referenceNumber }: { referenceNumber: string }) {
  const [state, action, pending] = useActionState(verifyUsdFundingRequest, {});
  return <form action={action} className="inline-form"><input type="hidden" name="referenceNumber" value={referenceNumber} /><button className="button button-secondary button-small" disabled={pending}>{pending ? "Checking with Paga…" : "Check payment status"}</button><FormStatus error={state.error} success={state.success} /></form>;
}
