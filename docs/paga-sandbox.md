# Paga Sandbox setup

Kintovo currently connects to Paga Sandbox only. Live provider operations are rejected by the server adapter.

## Vercel environment variables

Set these for the deployment environment you are testing, then redeploy:

```text
PAGA_ENVIRONMENT=sandbox
PAGA_ENABLE_SANDBOX=true
PAGA_SANDBOX_PUBLIC_KEY=...
PAGA_SANDBOX_SECRET_KEY=...
PAGA_SANDBOX_HASH_KEY=...
PAGA_ACCOUNT_CALLBACK_URL=https://kintovo.vercel.app/api/webhooks/paga/accounts
PAGA_USD_COLLECTION_CALLBACK_URL=https://kintovo.vercel.app/api/webhooks/paga/usd
PAGA_PAYOUT_CALLBACK_URL=https://kintovo.vercel.app/api/webhooks/paga/payouts
PAGA_BANK_ENCRYPTION_KEY=...
```

Generate `PAGA_BANK_ENCRYPTION_KEY` in a trusted terminal with:

```bash
openssl rand -base64 32
```

Store the result as a server-side environment variable; never commit it or paste it into chat. Use the same stable key in each Vercel environment that may hold encrypted bank destinations. If the key is lost or changed, Kintovo cannot decrypt the saved account numbers for payouts.

Paga verifies integration calls from whitelisted IP addresses. Confirm the Vercel egress address used by the project is allowed on the Paga Sandbox account.

## Database migrations

The Paga workflows add payout callback guards, bind each withdrawal to the bank destination selected when it was requested, and track business-to-talent compensation transfers. Apply all pending migrations to the database used by the deployment:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

Prisma CLI uses `DIRECT_URL`; ensure it targets the same database as the deployment's runtime `DATABASE_URL` before running the migration.

## Sandbox flow

1. A Creator or Specialist opens **Wallet & payouts**. Kintovo provisions or retries their NGN Paga subsidiary account.
2. They load Paga's bank list, enter a bank account number, and save it only after `validateDepositToBank` returns the bank-registered holder name.
3. Their withdrawal availability is calculated from a fresh Paga account balance minus active reservations. Simulated compensation history is not counted as spendable Paga money.
4. After the 24-hour hold, Finance approves or rejects the request. Approval debits the user's subsidiary account and sends a Paga bank transfer. A signed callback or Paga transaction-status lookup is required before the request becomes paid.
5. Paga Sandbox payout testing documents Access Bank account `0000000000` as test data. Verify the current test data in Paga's [Money Transfer documentation](https://developer-docs.paga.com/docs/money-transfer-payout).

Approved NGN project milestones and published creator campaign fees/bonuses are sent from the organisation's ledger-backed Paga account to the recipient's ledger-backed Paga account. Finance can retry an uncertain provider response with the same idempotent transfer reference. Both accounts must be active and the organisation account must hold enough NGN. EUR and GBP obligations cannot be paid through this Paga route.

Business USD funding instructions are not themselves proof of payment. The business can query the authenticated Paga payment-status endpoint. Paga's paid status is `data.statusCode = 0`; Kintovo still waits for the callback conversion details before crediting the subsidiary account. If the reported NGN conversion differs from the requested amount, the wallet credit is capped at the lower amount and the difference is displayed for reconciliation.

## Current currency boundaries

Paga subsidiary accounts and bank payouts in this integration are NGN. Paga's separate USD collection flow generates USD bank-transfer instructions that settle as NGN. EUR and GBP funding or withdrawals are not offered by this integration; do not enable those currencies without another verified provider flow.

## Payout failure and reversal recovery

The payout status endpoint can report pending, duplicate, failed, or successful outcomes. A non-settled response is not, by itself, proof that funds returned to the Paga business balance. Finance must use the authenticated status response and Paga's merchant transaction records to confirm the exact withdrawal amount was reversed before starting a reimbursement.

When Paga's status response contains a reversal identifier for the exact NGN amount, the Finance action submits a top-up to the user's subsidiary account using one persisted reference. The withdrawal remains reserved until the signed `SUBSIDIARY_ACCOUNT_TOP_UP_COMPLETE` callback credits that exact account and amount. A late settlement callback after reimbursement is recorded as an exception for manual Finance investigation. If Paga does not expose a confirmed reversal, keep the withdrawal processing and resolve it with Paga support; do not release or pay it a second time.

Before submitting a bank payout, Kintovo revalidates the saved beneficiary for the payout amount, reads the merchant's spendable `availableBalance`, and checks it covers the amount plus Paga's fee/VAT estimate. The estimate and actual posted fee can differ; keep the Paga business balance funded and reconcile the provider history. Reimbursement also depends on sufficient spendable merchant balance.
