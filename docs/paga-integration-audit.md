# Paga Engine integration discovery and API register

Reviewed against the Paga Engine documentation marked v1.5 on 15 November 2026. This is a technical discovery and implementation-status report; it does not assert that a Paga account, product permission, or provider test is available to Kintovo.

## Repository audit

Kintovo is a Next.js 16 App Router application using React 19, TypeScript, Auth.js, Prisma 7, and PostgreSQL. It is a modular monolith. Server actions and route handlers are under `app/`; domain code and authorization helpers are under `src/server/`; the relational schema and committed migrations are under `prisma/`.

| Existing area | Current behavior | Paga integration implication |
|---|---|---|
| Agreements and milestones | Accepted agreements create milestone records; review/approval transitions are handled in project delivery actions. | Agreement amounts are not provider collection orders. An approved milestone creates a compensation obligation. |
| Compensation | `CompensationObligation` is the payable ledger source for milestones, campaign fixed fees, and bonuses. Paga-tagged obligations remain pending until Finance initiates and Paga confirms the NGN subsidiary transfer. | This model represents professional compensation. It is not a buyer funding balance or a Paga subsidiary account. |
| Finance operations | Finance/Admin roles can manage simulated records, reconcile Paga compensation transfers, review withdrawals, check payout status, and request reimbursement when Paga confirms a reversal. | Payout failures without a provider-confirmed reversal remain reserved for manual provider investigation; do not release them based only on a non-settled response. |
| Payment display | `/workspace/payments` lists obligations and ledger entries, distinguishing simulated, awaiting-provider, and Paga-confirmed records. | No Checkout/payment request initiation UI exists. |
| Funding | `/workspace/funding` provisions a Paga subsidiary account and creates USD bank-transfer instructions for the organisation. | Sandbox-only; provider product entitlements, callback setup, and end-to-end validation still gate use. |
| Webhooks | `/api/webhooks/payments` accepts a generic SHA-256 HMAC event shape when `PAYMENT_MODE=provider`. It is not a Paga webhook and must not be used for Paga. | Paga uses endpoint-specific SHA-512 concatenation hashes and distinct callback payloads. |
| Access | `requireUser`, organisation membership, spend authority, and finance/admin role checks are server-side. | Paga-facing actions must reuse these checks and must not trust client status or identifiers alone. |
| Database | Compensation remains separate from Paga subsidiary accounts, NGN ledger entries, USD collection records, bank destinations, payouts, and reimbursement tracking. | Apply and validate committed migrations before using the new database models. |

The repository contains `docs/brand.md` and a previous product discovery report, but the pitch deck and design-system PDFs referenced by the broader `implementation.md` are not present in this workspace. The current Paga task can use the prior discovery report for context; PDF-specific claims cannot be revalidated here.

## Architecture and workflow map

The existing provider seam is `src/server/payments.ts`, presently a local simulation helper and generic webhook verifier. The Paga adapter is separate in `src/server/paga.ts`: it implements the documented Collect Basic and Business `principal`/`credentials` auth styles, SHA-512 request hashes, Sandbox API calls, account operations, USD collection, and account callbacks. Paga Sandbox is disabled by default and Live is rejected in code.

Paga subsidiary-account funding is implemented for organisation and personal accounts. USD collection is a distinct request flow, not a multi-currency account. NGN compensation transfers and Finance-approved NGN bank payout attempts are implemented in Sandbox. Paga bank payouts draw from the merchant business balance, and the account owner remains responsible for ensuring fees and VAT are covered. No claim is made that Kintovo has successfully completed an end-to-end Sandbox transaction or received approval for Live marketplace use.

## Official API register and Kintovo classification

Classification: **1** direct and approved; **2** useful but account/provider/legal approval or missing requirements; **3** future/optional; **4** outside current product. No operation is category 1 because Kintovo has no supplied Paga account approval, keys, allowlisted deployment egress IP, or written marketplace-use decision. “Blocked” below is specific; it does not imply the API is undocumented.

### Accept payments

| Operation | Documented interface / environment | Kintovo mapping and status |
|---|---|---|
| Paga Checkout | Hosted checkout at `beta-checkout.paga.com` / `checkout.paga.com`; browser form/link/JS; notification and separate Verify charge | 2 — Potential buyer collection; marketplace collection/use approval missing. No checkout integration. |
| Create dynamic virtual account/payment request | `POST /paymentRequest`, Collect Sandbox `beta-collect.paga.com`, Live `collect.paga.com`; Basic auth + operation hash | 2 — Potential one-off project collection; not safe to apply to compensation obligations before provider confirms marketplace model. |
| Payment request status | `POST /status` on Collect; reference hash | 2 — Needed for recovery/reconciliation if payment requests are approved; not implemented. |
| Collect history | `POST /history`; date-window activity, optionally narrowed to request/account reference | 3 — Could support reconciliation after approved account setup; not implemented. |
| Collect bank directory | `POST /banks` | 2 — Needed for USSD/bank collection choices; no approved collect flow. |
| Payment request notification | Callback; `PAYMENT_COMPLETE`, notification ID, state, amount/balance and SHA-512 hash | 2 — Required for approved collect; generic Kintovo webhook is incompatible. Paga-specific event route not implemented. |
| Bank USSD / bank directory | `POST /banks`, `POST /paymentRequest` with `FUNDING_USSD`, `POST /status`; `beta-collect.paga.com` / `collect.paga.com` | 2 — Same buyer collection approval dependency; not implemented. |
| Paga Wallet request | Collect payment request and callback/status flow | 2 — Same buyer collection approval dependency; not implemented. |
| Direct Debit / Open Banking | Mandate setup and recurring debit operations, callbacks/status as documented | 3 — Kintovo currently has no subscription, loan repayment, or recurring buyer charge product. Do not collect mandates for one-off project work. |
| Cross-border USD collection (ACH, Wire, SWIFT) | Dynamic payment identifier / collection guides; Paga converts settlement to NGN; operation-specific setup | 2 — Could support international buyers, but account/currency/FX and marketplace approvals and requirements are unresolved. Not implemented. |
| Refund / cancel payment request | `POST /refund/v2` on Collect; unique refund reference; partial amounts supported for documented request types | 2 — Needed only after an approved collection integration; cannot refund a Paga payment Kintovo has not recorded. Not implemented. |
| Become a biller / merchant notification | Paga calls merchant notification endpoints; business onboarding and callback contract | 4 — Kintovo is a project network, not a utility/merchant biller; no relevant customer bill to sell. |

### Manage accounts and operations

| Operation | Documented interface / environment | Kintovo mapping and status |
|---|---|---|
| Create/update/disable/retrieve subsidiary accounts | Collect API under `/subsidiary-accounts` and account operation paths; Sandbox `beta-collect.paga.com`, Live `collect.paga.com`; Basic auth + per-operation hash | 2 — Do not create customer accounts or hold project funds absent specific written permission. Paga describes merchant as legal owner; this is not escrow. Not implemented. |
| Subsidiary account balance/history | Per-account balance and transaction history operations | 2 — Dependent on approval and an approved account use case; not implemented. |
| Persistent Payment Identifier create/update/delete/get | Legacy Collect API: `registerPersistentPaymentAccount`, `updatePersistentPaymentAccount`, `deletePersistentPaymentAccount`, `getPersistentPaymentAccount` | 2 — Same account approval/custody dependency; do not equate PPI or subsidiary balance with escrow. Not implemented. |
| Charge/top up/transfer between subsidiary accounts | Collect API account operations; reference/hash/callback requirements vary by operation | 2 — Would move third-party/customer funds; explicit permission and legal review required. Not implemented. |
| Subsidiary settlement/autosweep configuration | Account creation/update `autoSweep` options (Paga, bank, or ledger-held account) | 2 — Settlement/custody choice has legal and account implications; disabled. |
| Paga business balance | `POST /paga-webservices/business-rest/secured/accountBalance`; Sandbox `beta.mypaga.com`, Live `www.mypaga.com`; `principal`, `credentials`, hash | 3 — Useful only after Kintovo has an approved Paga business balance; no credentials. Not implemented. |
| Business transaction history and recent history | `transactionHistory`, `recentTransactionHistory` on Business API; date range or last five transactions | 3 — Useful for finance reconciliation after account setup; no credentials. Not implemented. |
| Statements/downloadable records | Business portal CSV/PDF export described; not an application endpoint in the reviewed guide | 3 — Operations can use portal exports after onboarding; no code path. |
| Account funding/charges/transfers | Business and subsidiary account operations, depending on flow | 2 — Requires account ownership/product decision and corresponding approval; no Kintovo operation implemented. |

### Payouts and value-added services

| Operation | Documented interface / environment | Kintovo mapping and status |
|---|---|---|
| Get bank directory | Business API `POST /paga-webservices/business-rest/secured/getBanks`; Sandbox `beta.mypaga.com`, Live `www.mypaga.com`; principal/credentials and reference hash | 2 — Needed for Nigerian professional payouts; no recipient onboarding or account permission. Not implemented. |
| Validate bank account | Business API `validateDepositToBank`; hash includes reference, amount, bank UUID, account number | 2 — Needed before an authorized payout. Sensitive recipient data model is absent. Not implemented. |
| Nigerian bank transfer | Business API `depositToBank`; Paga business balance; callback/status | 2 — Directly relevant to specialist/creator compensation, but written third-party marketplace payout approval and verified destination are missing. Not implemented. |
| Paga wallet validation/transfer | Business API `validateMoneyTransfer` and `moneyTransfer` | 2 — Potential payout method; recipient selection, approval, and payout policy missing. Not implemented. |
| Transfer status and callback | Business API transaction status plus `statusCallbackUrl` | 2 — Required for payout settlement; no Paga callback route or mapping implemented. |
| Bulk money transfer (`moneyTransferBulk`) | Legacy Business API operation; maximum 300 items per bulk request | 2 — May fit approved compensation payouts, but bulk use and third-party payout permission require Paga approval. Not implemented. |
| Airtime/data operators and purchase | `getMobileOperators`, `airtimeAndDataPurchase` on Business API | 4 — No Kintovo user need or in-scope product for selling top-ups. |
| Billers/services/customer validation/payment | `getMerchants`, `getMerchantServices`, `merchantAccountDetails`, `merchantPayment` | 4 — Kintovo is not a consumer bill payment app. |
| Remittance | Current v1.5 site describes ledger-backed remittance payouts to Nigerian banks/Paga wallets; exact product/account eligibility needs Paga confirmation | 3 — Not a Kintovo remittance product; do not hold or transmit user remittances. |

### Additional operations in Paga’s legacy Business API collection

The official Business API operations page is an older, separate collection from the grouped v1.5 guides. These operation names are retained here so they are not silently treated as absent. Per-operation request/response/error schemas should be reconciled with Paga before use; no legacy operation has been enabled.

| Operation | Kintovo classification | Reason / status |
|---|---|---|
| Register Customer | 4 | Kintovo is not opening Paga wallets/accounts for customers. |
| Register Customer With KYC | 4 | Same; unnecessary transfer of identity data to Paga for the current workflow. |
| Register Customer Account Photo | 4 | Not relevant to Kintovo account creation. |
| Register Customer Identification Photo | 4 | Not relevant; Kintovo does not collect or submit Paga account KYC. |
| Validate Money Transfer | 2 | Relevant for Paga-wallet payouts, but approval and payout destination onboarding are missing. |
| Money Transfer | 2 | Potential Paga wallet payout; same provider approval dependency. |
| Airtime and Data Purchase | 4 | No top-up resale feature in product scope. |
| Merchant Payment | 4 | Kintovo is not a bill-pay customer application. |
| Validate Deposit To Bank | 2 | Relevant bank payout validation; recipient storage and permission missing. |
| Deposit To Bank | 2 | Relevant professional/creator compensation payout, but provider marketplace approval missing. |
| Account Balance | 3 | Useful to finance after business account approval. |
| Transaction History | 3 | Useful for reconciliation after business account approval. |
| Recent Transaction History | 3 | Useful for finance after business account approval. |
| Get Merchants | 4 | Enables unrelated bill payment catalog. |
| Get Merchant Services | 4 | Enables unrelated bill payment catalog. |
| Get Banks | 2 | Required for approved payouts; no endpoint call implemented. |
| Get Operation Status | 2 | Needed to recover approved transfer status; no payout adapter implemented. |
| Get Mobile Operators | 4 | No top-up resale feature. |
| Get Data Bundle By Operator | 4 | No top-up resale feature. |
| Onboard Merchant | 4 | Documented as restricted to Paga merchant aggregators; Kintovo has no such role. |
| Bulk Money Transfer (up to 300 items) | 2 | Could batch approved payouts; per-recipient checks, aggregate limits, and written approval required. |

The current v1.5 grouped Business API guide also identifies `getBanks`, `validateDepositToBank`, `depositToBank`, and transfer status/callback operations. The older collection adds account registration/KYC, Paga-wallet transfers, VAS, merchant catalog, and bulk transfer. These sources are not assumed to be interchangeable: obtain Paga confirmation of the current supported method, auth, host, and account entitlement for each desired operation.

### Documentation/source issues

- Paga v1.5 guidance describes HTTP Basic plus a `hash` header for Collect operations. The Business API uses `principal` and `credentials` headers plus an operation-specific SHA-512 hash. Checkout `Verify charge` documents Basic auth but its example does not show a hash header. Authentication must be implemented per endpoint, never generalized across product areas.
- Current v1.5 guides include both a new grouped documentation set and a legacy Business REST API operation collection. Some older API-reference pages do not clearly state whether they are superseded. This register uses the v1.5 grouped guides for current collect/account behavior and references the Business API guide for payout/VAS operations. Confirm any disputed route or account entitlement with Paga before enabling it.
- Paga’s general overview says the platform can hold/move user funds, while Kintovo’s approved use case and any marketplace, milestone, disputed-funds, partial-settlement, or third-party payout permission are not established by public technical documentation. A public API description is not Kintovo account approval.
- The older Collect API operation collection lists separate payment-request status/refund/history/bank-list operations and a Persistent Payment Identifier lifecycle, while the newer grouped guide uses Dynamic Virtual Account and Subsidiary Account terminology. Do not mix their request shapes or account concepts without Paga confirmation.
- Current docs say Sandbox accounts require approval; Sandbox uses simulated funds and separate keys. No Paga keys or account approval were found in repository configuration. Live keys are unavailable and Live code paths intentionally throw.

## Current implementation status (18 November 2026)

- `POST https://beta-collect.paga.com/subsidiary-accounts` provisions ledger-backed NGN accounts for business organisations and personal creator/specialist users. Account creation runs after signup or from the business funding page. The merchant remains the legal owner under Paga's account guide; this is not escrow.
- `/api/webhooks/paga/accounts` verifies the signed subsidiary funding notification and signed account-operation callback, then records idempotent NGN ledger entries.
- USD collection uses `POST https://qa1-collect.paga.com/paymentRequest`; status verification uses `POST https://qa1-collect.paga.com/status` with `paymentCurrency=USD`. The USD webhook has no documented signature header, so Kintovo confirms the reference through Paga's authenticated status API. A confirmed payment triggers an NGN subsidiary-account top-up with a stable reference. Only the originally requested NGN amount is credited; FX/overpayment differences require finance reconciliation.
- Paga subsidiary accounts support NGN only. EUR and GBP are unavailable. USD converts to NGN; this is not a USD wallet.
- The user reports a verified Sandbox account. Credentials are kept outside source control. Confirm exact account entitlements, allowlisted deployment egress, public HTTPS callbacks, and a successful Sandbox request/callback cycle before relying on the integration. Sandbox activity uses test funds; Live requests remain disabled.
- Bank directory lookup, encrypted destination storage, Finance approval, beneficiary revalidation, merchant `availableBalance` and fee/VAT checks, Paga bank transfer, signed callback, and authenticated status reconciliation are implemented. On provider-confirmed reversal, Finance can initiate a same-reference NGN reimbursement to the user's subsidiary account; the withdrawal remains reserved until Paga's signed credit callback. Other unresolved outcomes stay reserved for manual Paga investigation.
- Approved NGN milestone and campaign obligations can transfer from a business subsidiary account to the recipient's Paga account. Simulated obligations remain separate and do not fund withdrawals.
- USD settlement differences are capped conservatively and recorded for manual reconciliation. If the USD callback is lost, the status endpoint alone does not return conversion details needed to credit the NGN account; Finance needs a provider-side reconciliation process.
- No successful provider request has been evidenced in this repository. Apply the latest migrations and run build/type checks in the configured Codespace before enabling Sandbox. The generic SHA-256 `/api/webhooks/payments` handler remains separate and must not be used for Paga.

## Provider questions and production gates

Before relying on the Sandbox workflows, confirm account entitlements, callback reachability, deployment egress allowlisting, and a successful tested lifecycle. Before Live, obtain written Paga confirmation for collecting business payments for third-party engagements; paying independent professionals/creators; subsidiary-account use; holding balances pending work; milestone/partial settlement; disputes/refunds; and exact product entitlements for Kintovo. Keep Live disabled until provider, legal, financial, security, and operational approvals are complete.

## Official documentation reviewed

- [Paga Engine home and v1.5 product index](https://developer-docs.paga.com/)
- [Get started and account approval](https://developer-docs.paga.com/docs/get-started)
- [Hashing rules](https://developer-docs.paga.com/docs/handling-hash)
- [Paga Checkout, notification, and Verify charge](https://developer-docs.paga.com/docs/checkout-js)
- [Bank USSD](https://developer-docs.paga.com/docs/bank-ussd-payment)
- [Direct Debit](https://developer-docs.paga.com/docs/direct-debit-api)
- [Paga Wallet](https://developer-docs.paga.com/docs/paga-wallet)
- [USD collection](https://developer-docs.paga.com/docs/paga-dynamic-payment-identifier-usd-collection)
- [Refunds](https://developer-docs.paga.com/docs/refunds)
- [Subsidiary accounts](https://developer-docs.paga.com/docs/subsidiary-accounts)
- [Create a subsidiary account](https://developer-docs.paga.com/reference/subsidiary-accounts-createsubsidiaryaccount)
- [Handle subsidiary funding notifications](https://developer-docs.paga.com/reference/subsidiary-accounts-subsidiaryfunding)
- [Handle charge/top-up/transfer notifications](https://developer-docs.paga.com/reference/subsidiary-accounts-subsidiaryoperation)
- [Create USD bank-transfer payment request](https://developer-docs.paga.com/reference/usd-bank-transfer-createpaymentrequest)
- [Handle USD collection webhook](https://developer-docs.paga.com/reference/usd-bank-transfer-usdpaymentwebhook)
- [Verify USD collection status](https://developer-docs.paga.com/reference/usd-bank-transfer-getusdpaymentstatus)
- [Business account operations](https://developer-docs.paga.com/docs/your-business-account)
- [Money Transfer](https://developer-docs.paga.com/docs/money-transfer-payout)
- [Airtime and data](https://developer-docs.paga.com/docs/airtime-and-data-purchase)
- [Bill payment](https://developer-docs.paga.com/docs/bill-payment)
- [Become a biller](https://developer-docs.paga.com/docs/become-a-biller)
- [Legacy Collect API Operations](https://developer-docs.paga.com/docs/operations-1)
- [Business API operation index](https://developer-docs.paga.com/docs/business-rest-api)
- [Business API Operations](https://developer-docs.paga.com/docs/business-rest-api-operations)
- [Postman collection](https://developer-docs.paga.com/docs/postman-collection)
