import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createSimulatedSettlement, verifyPaymentWebhookSignature } from "./payments";
import { calculatePaymentFeeBreakdown } from "./payment-fees";

test("simulated settlement is explicitly marked as mock", () => {
  const time = new Date("2026-01-02T03:04:05.000Z");
  const result = createSimulatedSettlement(time);
  assert.equal(result.status, "SIMULATED_PAID");
  assert.equal(result.provider, "MOCK");
  assert.equal(result.paidAt, time);
  assert.match(result.eventId, /^mock_/);
});

test("webhook signature verification checks the raw-body HMAC", () => {
  const body = '{"eventId":"event-1"}';
  const secret = "test-only-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyPaymentWebhookSignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifyPaymentWebhookSignature(`${body} `, `sha256=${signature}`, secret), false);
  assert.equal(verifyPaymentWebhookSignature(body, null, secret), false);
});

test("platform fee breakdown preserves the gross amount and calculates recipient funds", () => {
  assert.deepEqual(calculatePaymentFeeBreakdown({
    grossAmount: 100_000,
    currency: "NGN",
    platformFeeBps: 1_000,
    providerFee: 1_500,
    feePayer: "BUSINESS",
  }), {
    grossAmount: 100_000,
    platformFee: 10_000,
    providerFee: 1_500,
    recipientAmount: 98_500,
    currency: "NGN",
  });
});

test("recipient-paid platform fees reduce the recipient amount", () => {
  const result = calculatePaymentFeeBreakdown({ grossAmount: 100_000, currency: "NGN", platformFeeBps: 1_000, providerFee: 1_500, feePayer: "RECIPIENT" });
  assert.equal(result.recipientAmount, 88_500);
});
