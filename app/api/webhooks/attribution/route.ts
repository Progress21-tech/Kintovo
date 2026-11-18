import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { countsAfterRefund, evaluateConversion, type RefundTreatment } from "@/server/attribution";
import { notify } from "@/server/notifications";
import { verifyPaymentWebhookSignature } from "@/server/payments";

const PROVIDER = "ATTRIBUTION";

const eventSchema = z.object({
  eventId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,99}$/),
  type: z.enum(["lead", "order", "refund", "cancellation"]),
  referralCode: z.string().min(3).max(100),
  orderReference: z.string().trim().min(1).max(120).optional(),
  amount: z.number().int().min(0).max(2_147_483_647).default(0),
  currency: z.string().length(3).optional(),
  occurredAt: z.iso.datetime(),
  environment: z.enum(["test", "live"]),
});

/**
 * Signed conversion events from a merchant integration or a test harness.
 * Header: `x-kintovo-signature: sha256=<hex HMAC of the raw body with ATTRIBUTION_WEBHOOK_SECRET>`.
 * Events are deduplicated by eventId, logged immutably, and land as PENDING
 * attributions for human review; nothing here pays a bonus directly.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 20_000) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyPaymentWebhookSignature(raw, request.headers.get("x-kintovo-signature"), process.env.ATTRIBUTION_WEBHOOK_SECRET ?? "")) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid event", issues: parsed.error.issues.map((issue) => issue.path.join(".")) }, { status: 400 });
  const event = parsed.data;
  if (event.environment === "live" && process.env.ATTRIBUTION_LIVE_ENABLED !== "true") return Response.json({ error: "Live attribution events are not enabled" }, { status: 403 });

  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const existing = await db.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider: PROVIDER, eventId: event.eventId } } });
  if (existing) return Response.json({ duplicate: true, processed: Boolean(existing.processedAt) });
  const logged = await db.paymentWebhookEvent.create({ data: { provider: PROVIDER, eventId: event.eventId, eventType: event.type, payloadHash } });

  const finish = async (note: string, status = 200) => {
    await db.paymentWebhookEvent.update({ where: { id: logged.id }, data: { processedAt: new Date(), processingNote: note.slice(0, 500) } });
    return Response.json({ ok: status < 300, note }, { status });
  };

  const participation = await db.campaignCreator.findUnique({ where: { referralCode: event.referralCode }, include: { campaign: true, creator: { select: { userId: true } } } });
  if (!participation) return finish("Unknown referral code; event recorded and ignored.", 202);
  if (event.currency && event.currency !== participation.campaign.currency) return finish(`Currency ${event.currency} does not match the campaign currency.`, 422);
  const occurredAt = new Date(event.occurredAt);
  const simulated = event.environment !== "live";

  if (event.type === "refund" || event.type === "cancellation") {
    if (!event.orderReference) return finish("Refunds need the original order reference.", 422);
    const original = await db.campaignAttribution.findFirst({ where: { campaignCreatorId: participation.id, orderReference: event.orderReference, eventType: "ORDER" }, include: { bonusObligation: true } });
    if (!original) return finish("No matching order for this refund.", 202);
    if (countsAfterRefund(participation.campaign.refundTreatment as RefundTreatment)) {
      await db.auditLog.create({ data: { action: "CAMPAIGN_REFUND_RECORDED_STILL_ELIGIBLE", entityType: "CampaignAttribution", entityId: original.id, metadata: { eventId: event.eventId } } });
      return finish("Refund recorded; the campaign terms count refunded orders.");
    }
    await db.$transaction(async (tx) => {
      await tx.campaignAttribution.update({ where: { id: original.id }, data: { status: "REFUNDED", refundedAt: occurredAt, reviewerNote: `${event.type === "refund" ? "Refunded" : "Cancelled"} per signed event ${event.eventId}.` } });
      const obligation = original.bonusObligation;
      if (obligation) {
        if (obligation.status === "PENDING") {
          await tx.compensationObligation.update({ where: { id: obligation.id }, data: { status: "REFUNDED", failureReason: "Underlying conversion was refunded or cancelled." } });
          await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "BONUS_REVERSED_REFUND", amount: -obligation.amount, currency: obligation.currency, simulated: obligation.simulated, providerEventId: event.eventId } });
        } else {
          // Already settled: record the required adjustment for Finance; never claw back automatically.
          await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "REFUND_ADJUSTMENT_REQUIRED", amount: -obligation.amount, currency: obligation.currency, simulated: obligation.simulated, providerEventId: event.eventId } });
        }
      }
      await tx.auditLog.create({ data: { action: "CAMPAIGN_CONVERSION_REFUNDED", entityType: "CampaignAttribution", entityId: original.id, metadata: { eventId: event.eventId, bonusObligation: obligation?.id ?? null } } });
      await notify(tx, { userId: participation.creator.userId, category: "CAMPAIGN", title: "A campaign conversion was refunded", body: `Order ${event.orderReference} no longer counts toward your bonus under the agreed refund terms.`, href: "/workspace/campaigns", simulated });
    });
    return finish("Refund applied.");
  }

  const lastClick = await db.campaignClick.findFirst({ where: { campaignCreatorId: participation.id, occurredAt: { lte: occurredAt } }, orderBy: { occurredAt: "desc" }, select: { occurredAt: true } });
  const decision = evaluateConversion({ eventType: event.type === "lead" ? "LEAD" : "ORDER", occurredAt, lastClickAt: lastClick?.occurredAt ?? null, windowDays: participation.campaign.attributionWindowDays, campaignStartsAt: participation.campaign.startsAt, campaignEndsAt: participation.campaign.endsAt });
  const attribution = await db.campaignAttribution.create({ data: {
    campaignCreatorId: participation.id, sourceEventId: `${PROVIDER}:${event.eventId}`, orderReference: event.orderReference ?? null,
    amount: event.type === "order" ? event.amount : 0, currency: participation.campaign.currency, occurredAt,
    // Leads carry no bonus, so eligible leads are recorded directly; orders wait for human review.
    status: !decision.eligible ? "REJECTED" : event.type === "lead" ? "APPROVED" : "PENDING", reviewerNote: decision.eligible ? null : decision.reason,
    source: "WEBHOOK", eventType: event.type === "lead" ? "LEAD" : "ORDER", simulated,
  } });
  await db.auditLog.create({ data: { action: decision.eligible ? "CAMPAIGN_CONVERSION_RECEIVED" : "CAMPAIGN_CONVERSION_INELIGIBLE", entityType: "CampaignAttribution", entityId: attribution.id, metadata: { eventId: event.eventId, simulated, reason: decision.eligible ? null : decision.reason } } });
  return finish(decision.eligible ? (event.type === "lead" ? "Lead recorded." : "Order recorded for review.") : `Recorded as ineligible: ${decision.reason}`);
}
