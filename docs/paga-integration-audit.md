# Paga Engine integration discovery and API register

Reviewed against the Paga Engine documentation marked v1.5 on 15 November 2026. This is a technical discovery and implementation-status report; it does not assert that a Paga account, product permission, or provider test is available to Kintovo.

## Repository audit

Kintovo is a Next.js 16 App Router application using React 19, TypeScript, Auth.js, Prisma 7, and PostgreSQL. It is a modular monolith. Server actions and route handlers are under `app/`; domain code and authorization helpers are under `src/server/`; the relational schema and committed migrations are under `prisma/`.

| Existing area | Current behavior | Paga integration implication |
|---|---|---|
| Agreements and milestones | Accepted agreements create milestone records; review/approval transitions are handled in project delivery actions. | Agreement amounts are not provider collection orders. An approved milestone creates a compensation obligation. |
| Compensation | `CompensationObligation` is the payable ledger source for milestones, campaign fixed fees, and bonuses. New obligations are `MOCK` and simulated. | This model represents professional compensation. It is not a buyer funding balance or a Paga subsidiary account. |
| Finance operations | Finance/Admin roles can record simulated settlement, failure, refund, adjustment, and reconciliation events. | No Paga transfer execution or recipient bank details are implemented. Approved withdrawal requests do not send money. |
| Payment display | `/workspace/payments` lists obligations and ledger entries with explicit simulated/provider status labels. | No Checkout/payment request initiation UI exists. |
| Funding | `/workspace/funding` is an informational placeholder, and currently still mentions Paystack. | It must be replaced before claiming any provider funding flow. |
| Webhooks | `/api/webhooks/payments` accepts a generic SHA-256 HMAC event shape when `PAYMENT_MODE=provider`. It is not a Paga webhook and must not be used for Paga. | Paga uses endpoint-specific SHA-512 concatenation hashes and distinct callback payloads. |
| Access | `requireUser`, organisation membership, spend authority, and finance/admin role checks are server-side. | Paga-facing actions must reuse these checks and must not trust client status or identifiers alone. |
| Database | Compensation, append-only ledger entries, webhook receipt IDs, audit logs, migrations already exist. | A distinct buyer-side collection obligation and payout destination model are needed before money flows can map safely. |

The repository contains `docs/brand.md` and a previous product discovery report, but the pitch deck and design-system PDFs referenced by the broader `implementation.md` are not present in this workspace. The current Paga task can use the prior discovery report for context; PDF-specific claims cannot be revalidated here.

## Architecture and workflow map

The existing provider seam is `src/server/payments.ts`, presently a local simulation helper and generic webhook verifier. The new `src/server/paga.ts` is only a small cryptographic/configuration boundary: it implements ordered SHA-512 concatenation, timing-safe Checkout callback hash comparison, distinct Collect Basic and Business `principal`/`credentials` header builders, environment host selection, and disabled-by-default Sandbox credentials. It does not yet issue Paga requests or mutate the ledger.

Current financial workflow: accepted agreement → milestone → submission/review → compensation obligation → simulated finance action → append-only ledger entry. Paga collections would be a separate buyer obligation; provider-confirmed collection cannot itself authorize custody or conditional release. Payout flow would be: reviewed withdrawal/compensation amount → verified recipient/bank destination → bank/account validation → finance-authorized payout → provider callback/status verification → ledger settlement. That payout path is not implemented because destination records and account approval are absent.

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

## Implemented in this change

- `src/server/paga.ts`: ordered SHA-512 helper, constant-time Checkout callback hash check, distinct Collect/Business API auth header builders, correct separated Sandbox Collect and Business API base URLs, configuration validation, disabled-by-default Sandbox, and unconditional Live guard.
- `.env.example`: placeholders only; Sandbox disabled, no Live secrets.
- `src/server/paga.test.ts`: hash ordering, omitted-field handling, callback hash comparison, and environment/Live safeguards. Added to the test script.

No payment or payout endpoint is claimed as implemented or tested against Paga. This is a guide-level API register, not yet the requested field-by-field endpoint workbook: for each candidate operation, exact request schema, all response/status/error codes, test vectors, and callback edge cases still need validation against the current OpenAPI/Postman artifacts and Paga account. Actual API calls remain blocked because there is no approved Sandbox account/credential, account product permissions, fixed allowlisted egress IP, or callback URL. The generic SHA-256 `/api/webhooks/payments` handler must not be used for Paga.

## Provider questions and production gates

Obtain written Paga confirmation for: collecting business payments for third-party engagements; payouts to independent professionals/creators; subsidiary-account use; whether any balance may be held pending work approval; milestone and partial settlement; disputed funds; refunds; team payouts; cross-border collection; and the exact products enabled for Kintovo. Also obtain Sandbox approval/keys, production egress IP allowlisting, callback URL setup, rate/limit/error guidance, and Live approval. Keep `PAYMENT_MODE=simulated` and `PAGA_ENABLE_SANDBOX=false` until the Sandbox tests and account-specific scope are completed. Live remains disabled in code.

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
- [Business account operations](https://developer-docs.paga.com/docs/your-business-account)
- [Money Transfer](https://developer-docs.paga.com/docs/money-transfer-payout)
- [Airtime and data](https://developer-docs.paga.com/docs/airtime-and-data-purchase)
- [Bill payment](https://developer-docs.paga.com/docs/bill-payment)
- [Become a biller](https://developer-docs.paga.com/docs/become-a-biller)
- [Legacy Collect API Operations](https://developer-docs.paga.com/docs/operations-1)
- [Business API operation index](https://developer-docs.paga.com/docs/business-rest-api)
- [Business API Operations](https://developer-docs.paga.com/docs/business-rest-api-operations)
- [Postman collection](https://developer-docs.paga.com/docs/postman-collection)
