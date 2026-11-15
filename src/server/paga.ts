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
  return { environment, publicKey, secretKey, hashKey, collectBaseUrl: collectHosts.sandbox, businessBaseUrl: businessHosts.sandbox };
}

