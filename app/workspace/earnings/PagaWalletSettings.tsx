"use client";

import { useActionState, useState, useTransition } from "react";
import { FormStatus } from "@/components/FormStatus";
import { getPagaBankOptions, refreshPagaUserBalance, retryPagaUserAccount, savePagaBankDestination } from "./paga-actions";

type BankOption = { uuid: string; name: string };

export function PagaAccountRetryForm() {
  const [state, action, pending] = useActionState(retryPagaUserAccount, {});
  return <form action={action} className="inline-form"><button className="button button-secondary" disabled={pending}>{pending ? "Checking Paga…" : "Create or retry Paga account"}</button><FormStatus error={state.error} success={state.success} /></form>;
}

export function PagaBalanceRefreshForm() {
  const [state, action, pending] = useActionState(refreshPagaUserBalance, {});
  return <form action={action} className="inline-form"><button className="button button-secondary button-small" disabled={pending}>{pending ? "Checking…" : "Refresh from Paga"}</button><FormStatus error={state.error} success={state.success} /></form>;
}

export function PagaBankDestinationForm({ active }: { active: boolean }) {
  const [state, action, pending] = useActionState(savePagaBankDestination, {});
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, startTransition] = useTransition();

  function loadBanks() {
    setLoadError("");
    startTransition(async () => {
      const result = await getPagaBankOptions();
      if ("error" in result) setLoadError(result.error);
      else setBanks(result.banks);
    });
  }

  return <div className="panel-content">
    <p>Link a Nigerian bank account. Paga validates the account name before it can receive withdrawals. The account number is encrypted before storage and only its last four digits are shown here.</p>
    {!active ? <p className="field-note">Activate your Paga NGN account before linking a bank account.</p> : <>
      <button className="button button-secondary button-small" type="button" onClick={loadBanks} disabled={loading}>{loading ? "Loading Paga banks…" : banks.length ? "Refresh bank list" : "Load Paga banks"}</button>
      <FormStatus error={loadError} />
      {banks.length > 0 && <form action={action} className="form-stack" style={{ marginTop: 16 }}>
        <label>Bank<select name="bankPublicId" required defaultValue=""><option value="" disabled>Select a bank</option>{banks.map((bank) => <option value={bank.uuid} key={bank.uuid}>{bank.name}</option>)}</select></label>
        <label>Account number<input name="accountNumber" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" minLength={10} maxLength={10} required /></label>
        <p className="field-note">Paga validates the account using a non-transfer validation request. Review the returned account holder name before saving.</p>
        <FormStatus error={state.error} success={state.success} />
        <button className="button button-primary" disabled={pending}>{pending ? "Validating with Paga…" : "Validate and link bank"}</button>
      </form>}
    </>}
  </div>;
}
