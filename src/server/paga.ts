import { createHash, timingSafeEqual } from "node:crypto";

export type PagaEnvironment = "sandbox" | "live";

const collectHosts: Record<PagaEnvironment, string> = {
  sandbox: "https://beta-collect.paga.com",
  live: "https://collect.paga.com",
};

const businessHosts: Record<PagaEnvironment, string> = {
  sandbox: "https://beta.mypaga.com",
  live: "https://www.mypaga.com",
};

const usdCollectHosts: Record<PagaEnvironment, string> = {
  // Paga documents USD collection on a separate Sandbox host.
  sandbox: "https://qa1-collect.paga.com",
  live: "https://collect.paga.com",
};

/** SHA-512 of the exact documented concatenation. Callers must pass parameters in the endpoint's documented order. */
export function pagaSha512(values: readonly (string | number | null | undefined)[], hashKey: string) {
  if (!hashKey) throw new Error("Paga hash key is required.");
  return createHash("sha512").update([...values.map((value) => value == null ? "" : String(value)), hashKey].join("")).digest("hex");
}

export function verifyPagaSha512(values: readonly (string | number | null | undefined)[], hashKey: string, suppliedHash: string) {
  if (!/^[0-9a-f]{128}$/i.test(suppliedHash) || !hashKey) return false;
  const expected = Buffer.from(pagaSha512(values, hashKey), "hex");
  const actual = Buffer.from(suppliedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Paga Checkout notification hash: amount + timeStamp + paymentReference + hashKey. */
export function verifyPagaCheckoutNotification(input: { amount: string; timeStamp: string; paymentReference: string; hash: string }, hashKey: string) {
  return verifyPagaSha512([input.amount, input.timeStamp, input.paymentReference], hashKey, input.hash);
}

/** Collect API authentication documented for paymentRequest/status/refund endpoints. */
export function pagaCollectHeaders(config: { publicKey: string; secretKey: string; hashKey: string }, hashValues: readonly (string | number | null | undefined)[]) {
  return {
    Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`,
    hash: pagaSha512(hashValues, config.hashKey),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Business REST API uses principal/credentials rather than Collect's Basic header. */
export function pagaBusinessHeaders(config: { publicKey: string; secretKey: string; hashKey: string }, hashValues: readonly (string | number | null | undefined)[]) {
  return {
    principal: config.publicKey,
    credentials: config.secretKey,
    hash: pagaSha512(hashValues, config.hashKey),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export function getPagaConfiguration(environment = process.env.PAGA_ENVIRONMENT) {
  if (environment !== "sandbox" && environment !== "live") throw new Error("PAGA_ENVIRONMENT must be sandbox or live.");
  // No production transaction can be enabled by setting an environment name alone.
  if (environment === "live") throw new Error("Paga Live operations are disabled until explicit production approval is recorded.");
  if (process.env.PAGA_ENABLE_SANDBOX !== "true") throw new Error("Paga Sandbox is disabled. Set PAGA_ENABLE_SANDBOX=true only after account approval and callback setup.");
  const publicKey = process.env.PAGA_SANDBOX_PUBLIC_KEY;
  const secretKey = process.env.PAGA_SANDBOX_SECRET_KEY;
  const hashKey = process.env.PAGA_SANDBOX_HASH_KEY;
  if (!publicKey || !secretKey || !hashKey) throw new Error("Approved Paga Sandbox public, secret, and hash keys are required.");
  return {
    environment,
    publicKey,
    secretKey,
    hashKey,
    collectBaseUrl: collectHosts.sandbox,
    usdCollectBaseUrl: usdCollectHosts.sandbox,
    businessBaseUrl: businessHosts.sandbox,
  };
}

type PagaJson = Record<string, unknown>;

async function pagaRequest<T extends PagaJson>(input: {
  url: string;
  method: "GET" | "POST" | "PUT";
  headers: Record<string, string>;
  body?: PagaJson;
  timeoutMs?: number;
}) {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
    signal: AbortSignal.timeout(input.timeoutMs ?? 15_000),
    cache: "no-store",
  });
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Paga returned a non-JSON response (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`Paga request failed (HTTP ${response.status}).`);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Paga returned an invalid response.");
  return data as T;
}

function collectBasic(config: ReturnType<typeof getPagaConfiguration>, values: readonly (string | number | null | undefined)[]) {
  return pagaCollectHeaders(config, values);
}

function businessAuth(config: ReturnType<typeof getPagaConfiguration>, values: readonly (string | number | null | undefined)[]) {
  return pagaBusinessHeaders(config, values);
}

function requiredText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  return normalized;
}

/** Create a per-customer NGN ledger-backed account. Omitting autoSweep is intentional: sweep accounts hold no balance. */
export async function createPagaSubsidiaryAccount(input: {
  referenceNumber: string;
  accountReference: string;
  accountName: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  iifiNumber?: string;
  callbackUrl: string;
  fundingTransactionLimit?: number;
  fundingDailyLimit?: number;
}) {
  const config = getPagaConfiguration();
  const referenceNumber = requiredText(input.referenceNumber, "referenceNumber");
  const accountReference = requiredText(input.accountReference, "accountReference");
  if (accountReference.length < 11 || accountReference.length > 30) throw new Error("Paga accountReference must be between 11 and 30 characters.");
  const body = {
    referenceNumber,
    accountReference,
    accountName: requiredText(input.accountName, "accountName"),
    firstName: requiredText(input.firstName, "firstName"),
    lastName: requiredText(input.lastName, "lastName"),
    ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.iifiNumber ? { iifiNumber: input.iifiNumber } : {}),
    ...(input.fundingTransactionLimit !== undefined ? { fundingTransactionLimit: input.fundingTransactionLimit } : {}),
    ...(input.fundingDailyLimit !== undefined ? { fundingDailyLimit: input.fundingDailyLimit } : {}),
    status: "ACTIVE",
    callbackUrl: requiredText(input.callbackUrl, "callbackUrl"),
  };
  const hash = pagaSha512([
    referenceNumber, accountReference, input.iifiNumber ?? "", "", "", "", body.callbackUrl,
  ], config.hashKey);
  return pagaRequest<PagaJson>({
    url: `${config.collectBaseUrl}/subsidiary-accounts`,
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, hash, "Content-Type": "application/json", Accept: "application/json" },
    body,
  });
}

/** Read a subsidiary account balance from Paga; never use a browser-supplied balance. */
export async function getPagaSubsidiaryAccountBalance(accountReference: string, referenceNumber: string) {
  const config = getPagaConfiguration();
  const reference = requiredText(referenceNumber, "referenceNumber");
  const account = requiredText(accountReference, "accountReference");
  const hash = pagaSha512([reference, account], config.hashKey);
  const query = new URLSearchParams({ referenceNumber: reference });
  return pagaRequest<PagaJson>({
    url: `${config.collectBaseUrl}/subsidiary-accounts/${encodeURIComponent(account)}/balance?${query}`,
    method: "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, hash, Accept: "application/json" },
  });
}

/** Recover account provisioning after a timeout/duplicate response without creating a second account. */
export async function getPagaSubsidiaryAccount(accountReference: string, referenceNumber: string) {
  const config = getPagaConfiguration();
  const reference = requiredText(referenceNumber, "referenceNumber");
  const account = requiredText(accountReference, "accountReference");
  const hash = pagaSha512([reference, account], config.hashKey);
  const query = new URLSearchParams({ referenceNumber: reference });
  return pagaRequest<PagaJson>({
    url: `${config.collectBaseUrl}/subsidiary-accounts/${encodeURIComponent(account)}?${query}`,
    method: "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, hash, Accept: "application/json" },
  });
}

/** Top up a ledger-backed account from the Paga business balance (e.g. a settled USD collection converted to NGN). */
export async function topUpPagaSubsidiaryAccount(input: { accountReference: string; referenceNumber: string; amountNgn: string; narration?: string }) {
  const config = getPagaConfiguration();
  const account = requiredText(input.accountReference, "accountReference");
  const reference = requiredText(input.referenceNumber, "referenceNumber");
  const amount = Number(requiredText(input.amountNgn, "amountNgn"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amountNgn must be a positive number.");
  const amountHashValue = String(amount);
  const narration = input.narration ?? "";
  const hash = pagaSha512([reference, amountHashValue, "NGN", narration], config.hashKey);
  return pagaRequest<PagaJson>({
    url: `${config.collectBaseUrl}/subsidiary-accounts/${encodeURIComponent(account)}/top-up`,
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, hash, "Content-Type": "application/json", Accept: "application/json" },
    body: { referenceNumber: reference, amount, currency: "NGN", ...(narration ? { narration } : {}) },
  });
}

/** Move an approved user's NGN subsidiary balance to Kintovo's Paga business balance before a bank payout. */
export async function chargePagaSubsidiaryAccount(input: { accountReference: string; referenceNumber: string; amountNgn: string; narration?: string }) {
  const config = getPagaConfiguration();
  const account = requiredText(input.accountReference, "accountReference");
  const reference = requiredText(input.referenceNumber, "referenceNumber");
  const amount = Number(requiredText(input.amountNgn, "amountNgn"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("amountNgn must be a positive number.");
  const amountHashValue = String(amount);
  const narration = input.narration ?? "";
  const hash = pagaSha512([reference, amountHashValue, "NGN", narration], config.hashKey);
  return pagaRequest<PagaJson>({
    url: `${config.collectBaseUrl}/subsidiary-accounts/${encodeURIComponent(account)}/charge`,
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${config.publicKey}:${config.secretKey}`).toString("base64")}`, hash, "Content-Type": "application/json", Accept: "application/json" },
    body: { referenceNumber: reference, amount, currency: "NGN", ...(narration ? { narration } : {}) },
  });
}

export async function getPagaBanks(referenceNumber: string) {
  const config = getPagaConfiguration();
  const reference = requiredText(referenceNumber, "referenceNumber");
  return pagaRequest<PagaJson>({
    url: `${config.businessBaseUrl}/paga-webservices/business-rest/secured/getBanks`,
    method: "POST",
    headers: businessAuth(config, [reference]),
    body: { referenceNumber: reference },
  });
}

export async function validatePagaBankAccount(input: { referenceNumber: string; amountNgn: string; bankPublicId: string; accountNumber: string }) {
  const config = getPagaConfiguration();
  const reference = requiredText(input.referenceNumber, "referenceNumber");
  const amount = requiredText(input.amountNgn, "amountNgn");
  const bankPublicId = requiredText(input.bankPublicId, "bankPublicId");
  const accountNumber = requiredText(input.accountNumber, "accountNumber");
  return pagaRequest<PagaJson>({
    url: `${config.businessBaseUrl}/paga-webservices/business-rest/secured/validateDepositToBank`,
    method: "POST",
    headers: businessAuth(config, [reference, amount, bankPublicId, accountNumber]),
    body: { referenceNumber: reference, amount, currency: "NGN", destinationBankUUID: bankPublicId, destinationBankAccountNumber: accountNumber },
  });
}

export async function depositPagaToBank(input: { referenceNumber: string; amountNgn: string; bankPublicId: string; accountNumber: string; callbackUrl: string }) {
  const config = getPagaConfiguration();
  const reference = requiredText(input.referenceNumber, "referenceNumber");
  const amount = requiredText(input.amountNgn, "amountNgn");
  const bankPublicId = requiredText(input.bankPublicId, "bankPublicId");
  const accountNumber = requiredText(input.accountNumber, "accountNumber");
  const callbackUrl = requiredText(input.callbackUrl, "callbackUrl");
  return pagaRequest<PagaJson>({
    url: `${config.businessBaseUrl}/paga-webservices/business-rest/secured/depositToBank`,
    method: "POST",
    headers: businessAuth(config, [reference, amount, bankPublicId, accountNumber]),
    body: { referenceNumber: reference, amount, currency: "NGN", destinationBankUUID: bankPublicId, destinationBankAccountNumber: accountNumber, statusCallbackUrl: callbackUrl },
  });
}

/** Paga USD collection receives the amount in NGN and returns USD rail instructions; settlement remains NGN. */
export async function createPagaUsdCollection(input: {
  referenceNumber: string;
  amountNgn: string;
  payerName: string;
  payerPhoneNumber: string;
  payerEmail?: string;
  payeeName: string;
  callbackUrl: string;
}) {
  const config = getPagaConfiguration();
  const reference = requiredText(input.referenceNumber, "referenceNumber");
  const amount = Number(requiredText(input.amountNgn, "amountNgn"));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amountNgn must be a positive whole-naira amount.");
  const phone = requiredText(input.payerPhoneNumber, "payerPhoneNumber");
  const email = input.payerEmail ?? "";
  const expiryDateTimeUTC = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const body = {
    referenceNumber: reference,
    amount,
    currency: "NGN",
    payer: { name: requiredText(input.payerName, "payerName"), phoneNumber: phone, currency: "USD", ...(email ? { email } : {}) },
    payee: { name: requiredText(input.payeeName, "payeeName") },
    expiryDateTimeUTC,
    payerCollectionFeeShare: 1,
    recipientCollectionFeeShare: 0,
    isAllowPartialPayments: false,
    isAllowOverPayments: true,
    callBackUrl: requiredText(input.callbackUrl, "callbackUrl"),
    paymentMethods: ["BANK_TRANSFER"],
  };
  return pagaRequest<PagaJson>({
    url: `${config.usdCollectBaseUrl}/paymentRequest`,
    method: "POST",
    headers: collectBasic(config, [reference, amount, "NGN", phone, email]),
    body,
  });
}

/** Verify an unsigned USD collection webhook against Paga's authenticated status API. */
export async function getPagaUsdCollectionStatus(referenceNumber: string) {
  const config = getPagaConfiguration();
  const reference = requiredText(referenceNumber, "referenceNumber");
  return pagaRequest<PagaJson>({
    url: `${config.usdCollectBaseUrl}/status`,
    method: "POST",
    headers: collectBasic(config, [reference, "USD"]),
    body: { referenceNumber: reference, paymentCurrency: "USD" },
    timeoutMs: 3_500,
  });
}

export async function getPagaOperationStatus(referenceNumber: string) {
  const config = getPagaConfiguration();
  const reference = requiredText(referenceNumber, "referenceNumber");
  return pagaRequest<PagaJson>({
    url: `${config.businessBaseUrl}/paga-webservices/business-rest/secured/getOperationStatus`,
    method: "POST",
    headers: businessAuth(config, [reference]),
    body: { referenceNumber: reference },
  });
}

