import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPaymentWebhookSignature } from "@/server/payments";

export const runtime = "nodejs";

const providerEvent = z.object({ eventId: z.string().min(3).max(200), type: z.enum(["payment.succeeded", "payment.failed", "payment.refunded"]), reference: z.string().min(3).max(200), amount: z.number().int().nonnegative(), currency: z.string().length(3) });

export async function POST(request: Request) {
  // The adapter boundary is implemented for future provider work. No provider
  // is enabled in this deployment; do not accept live financial events yet.
  if (process.env.PAYMENT_MODE !== "provider" || !process.env.PAYMENT_WEBHOOK_SECRET) return NextResponse.json({ error: "Provider payment webhooks are disabled." }, { status: 503 });
  const rawBody = await request.text();
  if (rawBody.length > 32_000) return NextResponse.json({ error: "Webhook body too large." }, { status: 413 });
  if (!verifyPaymentWebhookSignature(rawBody, request.headers.get("x-kintovo-signature"), process.env.PAYMENT_WEBHOOK_SECRET)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let raw: unknown;
  try { raw = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = providerEvent.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const provider = process.env.PAYMENT_PROVIDER_NAME ?? "UNCONFIGURED";
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  try {
    await db.$transaction(async (tx) => {
      const receipt = await tx.paymentWebhookEvent.create({ data: { provider, eventId: parsed.data.eventId, eventType: parsed.data.type, payloadHash } });
      const obligation = await tx.compensationObligation.findUnique({ where: { reference: parsed.data.reference } });
      if (!obligation || obligation.simulated || obligation.amount !== parsed.data.amount || obligation.currency !== parsed.data.currency) {
        await tx.paymentWebhookEvent.update({ where: { id: receipt.id }, data: { processedAt: new Date(), processingNote: "Unknown obligation or amount/currency mismatch; finance review required." } });
        await tx.auditLog.create({ data: { action: "PAYMENT_WEBHOOK_RECONCILIATION_EXCEPTION", entityType: "PaymentWebhookEvent", entityId: receipt.id, metadata: { reference: parsed.data.reference } } });
        return;
      }
      if (parsed.data.type === "payment.succeeded") {
        await tx.compensationObligation.update({ where: { id: obligation.id }, data: { status: "PROVIDER_CONFIRMED_PAID", provider, paidAt: new Date(), failureReason: null, simulated: false } });
        await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "PROVIDER_SETTLEMENT", amount: obligation.amount, currency: obligation.currency, simulated: false, providerEventId: parsed.data.eventId } });
      } else if (parsed.data.type === "payment.failed") {
        await tx.compensationObligation.update({ where: { id: obligation.id }, data: { status: "FAILED", provider, failureReason: "Provider reported a failed payment." } });
        await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "PROVIDER_FAILURE", amount: 0, currency: obligation.currency, simulated: false, providerEventId: parsed.data.eventId } });
      } else {
        const settled = await tx.ledgerEntry.aggregate({ where: { obligationId: obligation.id, kind: { in: ["PROVIDER_SETTLEMENT", "SIMULATED_SETTLEMENT"] } }, _sum: { amount: true } });
        const refund = await tx.ledgerEntry.aggregate({ where: { obligationId: obligation.id, kind: { in: ["PROVIDER_REFUND", "SIMULATED_REFUND"] } }, _sum: { amount: true } });
        const remaining = (settled._sum.amount ?? 0) - (refund._sum.amount ?? 0);
        if (parsed.data.amount > remaining) throw new Error("Refund exceeds the recorded settled balance.");
        await tx.compensationObligation.update({ where: { id: obligation.id }, data: { status: parsed.data.amount >= remaining ? "REFUNDED" : "DISPUTED", provider } });
        await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "PROVIDER_REFUND", amount: parsed.data.amount, currency: obligation.currency, simulated: false, providerEventId: parsed.data.eventId } });
      }
      await tx.paymentWebhookEvent.update({ where: { id: receipt.id }, data: { processedAt: new Date(), processingNote: "Event applied to the provider ledger." } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Event could not be reconciled." }, { status: 409 });
  }
  return NextResponse.json({ received: true });
}
