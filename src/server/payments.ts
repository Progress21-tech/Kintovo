import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type SimulatedPaymentResult = { status: "SIMULATED_PAID"; provider: "MOCK"; eventId: string; paidAt: Date };

/** Local ledger adapter only. It never calls a bank, wallet, or payment processor. */
export function createSimulatedSettlement(now = new Date()): SimulatedPaymentResult {
  return { status: "SIMULATED_PAID", provider: "MOCK", eventId: `mock_${randomUUID()}`, paidAt: now };
}

export function verifyPaymentWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) return false;
  const candidate = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : "";
  if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const supplied = Buffer.from(candidate, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
