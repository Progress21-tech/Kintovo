import { NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/server/db";
import { getPagaConfiguration, getPagaUsdCollectionStatus, topUpPagaSubsidiaryAccount } from "@/server/paga";

function toMinor(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) && minor > 0 ? BigInt(minor) : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return NextResponse.json({ status: "INVALID" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }

  if (typeof body.referenceNumber !== "string" || !body.referenceNumber || (body.event !== "CAPTURED" && body.event !== "FUNDING_FAILED")) {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }
  let config;
  try { config = getPagaConfiguration(); }
  catch { return NextResponse.json({ status: "UNAVAILABLE" }, { status: 503 }); }

  const payment = await db.pagaUsdCollection.findUnique({ where: { referenceNumber: body.referenceNumber }, include: { account: { select: { id: true, accountReference: true, status: true } } } });
  if (!payment) return NextResponse.json({ status: "UNKNOWN_REFERENCE" }, { status: 404 });
  if (payment.status === "COMPLETED") return NextResponse.json({ status: "SUCCESS" });

  try {
    const verification = await getPagaUsdCollectionStatus(payment.referenceNumber);
    if (String(verification.statusCode) !== "0" || !verification.data || typeof verification.data !== "object") {
      return NextResponse.json({ status: "VERIFY_FAILED" }, { status: 503 });
    }
    const providerData = verification.data as Record<string, unknown>;
    if (typeof providerData.referenceNumber === "string" && providerData.referenceNumber !== payment.referenceNumber) return NextResponse.json({ status: "REFERENCE_MISMATCH" }, { status: 503 });
    const providerStatus = String(providerData.statusCode);
    if (body.event === "FUNDING_FAILED") {
      if (providerStatus === "0" || providerStatus === "1") return NextResponse.json({ status: "STATUS_MISMATCH" }, { status: 503 });
      await db.pagaUsdCollection.update({
        where: { id: payment.id },
        data: { status: "FUNDING_FAILED", failureReason: typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 300) : "Paga reported USD funding failure.", webhookData: JSON.parse(rawBody) },
      });
      return NextResponse.json({ status: "SUCCESS" });
    }
    if (providerStatus !== "0" || body.paymentStatus !== "CAPTURED" || typeof body.paymentId !== "string") {
      return NextResponse.json({ status: "PAYMENT_NOT_CONFIRMED" }, { status: 503 });
    }
    if (payment.paymentId && payment.paymentId !== body.paymentId) return NextResponse.json({ status: "PAYMENT_ID_MISMATCH" }, { status: 409 });

    const serviceDetails = body.serviceDetails;
    if (!serviceDetails || typeof serviceDetails !== "object" || Array.isArray(serviceDetails)) return NextResponse.json({ status: "INVALID" }, { status: 400 });
    const details = serviceDetails as Record<string, unknown>;
    if (details.sourceCurrency !== "USD" || details.destinationCurrency !== "NGN" || typeof details.destinationAmount !== "number") {
      return NextResponse.json({ status: "INVALID_CURRENCY" }, { status: 400 });
    }
    const reportedDestinationMinor = toMinor(details.destinationAmount);
    if (!reportedDestinationMinor || payment.account.status !== "ACTIVE") return NextResponse.json({ status: "INVALID_AMOUNT" }, { status: 400 });

    // The USD callback has no documented signature header. The authenticated
    // Paga status API proves this reference was paid. Use the callback's settled
    // conversion conservatively: never credit above the requested amount, and
    // preserve any FX discrepancy for later reconciliation.
    const destinationMinor = reportedDestinationMinor < payment.requestedNgnMinor ? reportedDestinationMinor : payment.requestedNgnMinor;
    const fxMismatch = reportedDestinationMinor !== payment.requestedNgnMinor;
    const sourceAmounts = body.receivedAmounts && typeof body.receivedAmounts === "object" && !Array.isArray(body.receivedAmounts)
      ? (body.receivedAmounts as Record<string, unknown>).amounts
      : null;
    const sourceAmountUsd = sourceAmounts && typeof sourceAmounts === "object" && !Array.isArray(sourceAmounts)
      ? (sourceAmounts as Record<string, unknown>).BASE
      : null;

    await db.pagaUsdCollection.updateMany({
      where: { id: payment.id, status: { in: ["REQUESTED", "CAPTURED", "TOP_UP_PENDING"] } },
      data: {
        status: "TOP_UP_PENDING",
        paymentId: body.paymentId,
        sourceAmountUsd: typeof sourceAmountUsd === "number" && Number.isFinite(sourceAmountUsd) ? String(sourceAmountUsd) : null,
        creditedAmountMinor: destinationMinor,
        reportedNgnMinor: reportedDestinationMinor,
        foreignExchangeRate: typeof details.foreignExchangeRate === "number" ? String(details.foreignExchangeRate) : null,
        webhookData: JSON.parse(rawBody),
        failureReason: fxMismatch ? "Paga's reported NGN settlement differed from the requested amount. A conservative credit was recorded; reconcile the difference in Paga." : null,
      },
    });
    const current = await db.pagaUsdCollection.findUnique({ where: { id: payment.id }, select: { status: true, creditedAmountMinor: true, paymentId: true } });
    if (!current || current.paymentId !== body.paymentId || !current.creditedAmountMinor) return NextResponse.json({ status: "PAYMENT_RECORD_CONFLICT" }, { status: 409 });

    after(async () => {
      try {
        const amountNgn = (Number(current.creditedAmountMinor) / 100).toFixed(2);
        const topUp = await topUpPagaSubsidiaryAccount({
          accountReference: payment.account.accountReference,
          referenceNumber: payment.topUpReference,
          amountNgn,
          narration: `USD collection ${payment.referenceNumber}`.slice(0, 100),
        });
        if (String(topUp.statusCode) !== "0") {
          await db.pagaUsdCollection.update({ where: { id: payment.id }, data: { failureReason: "Paga has not confirmed the NGN account top-up; reconciliation is required." } });
        }
      } catch (error) {
        console.error("Paga USD collection top-up needs retry", { referenceNumber: payment.referenceNumber, error });
        await db.pagaUsdCollection.update({ where: { id: payment.id }, data: { failureReason: "Paga has not confirmed the NGN account top-up; reconciliation is required." } });
      }
    });
    return NextResponse.json({ status: "SUCCESS" });
  } catch (error) {
    console.error("Paga USD webhook processing failed", { referenceNumber: payment.referenceNumber, error });
    return NextResponse.json({ status: "RETRY" }, { status: 503 });
  }
}
