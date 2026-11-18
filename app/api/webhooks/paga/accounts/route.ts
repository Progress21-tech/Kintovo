import { NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/server/db";
import { getPagaConfiguration, verifyPagaSha512 } from "@/server/paga";
import { startPagaBankTransfer } from "@/server/paga-payouts";

const fundingHashFields = ["transactionReference", "transactionDate", "amount", "accountNumber", "timestamp"] as const;

function rawJsonNumber(rawBody: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = rawBody.match(new RegExp(`\"${escapedKey}\"\\s*:\\s*(-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)`));
  return match?.[1];
}

function amountToMinor(amount: unknown) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || minor <= 0) return null;
  return BigInt(minor);
}

function formattedAmountToMinor(amount: unknown) {
  if (typeof amount !== "string" || !/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const value = Number(amount.replaceAll(",", ""));
  return amountToMinor(value);
}

async function handleOperationNotification(body: Record<string, unknown>) {
  const event = body.event;
  const expectedType = event === "SUBSIDIARY_ACCOUNT_TOP_UP_COMPLETE" ? "CREDIT" : "DEBIT";
  if (![
    "SUBSIDIARY_ACCOUNT_CHARGE_COMPLETE",
    "SUBSIDIARY_ACCOUNT_TOP_UP_COMPLETE",
    "SUBSIDIARY_ACCOUNT_TRANSFER_COMPLETE",
  ].includes(String(event))) return NextResponse.json({ status: "INVALID" }, { status: 400 });
  if (body.statusCode !== "0" || body.transactionType !== expectedType || typeof body.notificationId !== "string" || typeof body.externalReferenceNumber !== "string" || typeof body.transactionDate !== "string" || typeof body.accountNumber !== "string" || typeof body.accountReference !== "string" || typeof body.hash !== "string") {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }
  let config;
  try { config = getPagaConfiguration(); }
  catch { return NextResponse.json({ status: "UNAVAILABLE" }, { status: 503 }); }
  if (typeof body.amount !== "string" || !verifyPagaSha512([body.externalReferenceNumber, body.transactionDate, body.amount, body.accountNumber], config.hashKey, body.hash)) {
    return NextResponse.json({ status: "INVALID" }, { status: 401 });
  }
  const amountMinor = formattedAmountToMinor(body.amount);
  if (!amountMinor) return NextResponse.json({ status: "INVALID" }, { status: 400 });
  const account = await db.pagaAccount.findFirst({ where: { accountReference: body.accountReference, accountNumber: body.accountNumber }, select: { id: true, status: true } });
  if (!account || account.status !== "ACTIVE") return NextResponse.json({ status: "UNKNOWN_ACCOUNT" }, { status: 404 });
  const payout = event === "SUBSIDIARY_ACCOUNT_CHARGE_COMPLETE"
    ? await db.pagaPayout.findUnique({ where: { chargeReference: body.externalReferenceNumber as string }, select: { id: true, accountId: true, withdrawalRequestId: true } })
    : null;
  if (payout && payout.accountId !== account.id) return NextResponse.json({ status: "PAYOUT_ACCOUNT_MISMATCH" }, { status: 409 });
  const compensationTransfer = event === "SUBSIDIARY_ACCOUNT_TRANSFER_COMPLETE"
    ? await db.pagaCompensationTransfer.findUnique({ where: { referenceNumber: body.externalReferenceNumber as string }, include: { obligation: true } })
    : null;
  if (compensationTransfer && (compensationTransfer.sourceAccountId !== account.id || compensationTransfer.amountMinor !== amountMinor)) {
    return NextResponse.json({ status: "TRANSFER_ACCOUNT_OR_AMOUNT_MISMATCH" }, { status: 409 });
  }
  const ledgerAmountMinor = event === "SUBSIDIARY_ACCOUNT_CHARGE_COMPLETE" && typeof body.totalDebitAmount === "number"
    ? amountToMinor(body.totalDebitAmount)
    : amountMinor;
  if (!ledgerAmountMinor) return NextResponse.json({ status: "INVALID_AMOUNT" }, { status: 400 });

  try {
    await db.$transaction(async (tx) => {
      const usdCollection = event === "SUBSIDIARY_ACCOUNT_TOP_UP_COMPLETE"
        ? await tx.pagaUsdCollection.findUnique({ where: { topUpReference: body.externalReferenceNumber as string }, select: { id: true, status: true, failureReason: true } })
        : null;
      await tx.pagaAccountLedgerEntry.create({
        data: {
          accountId: account.id,
          reference: body.externalReferenceNumber as string,
          direction: expectedType,
          kind: usdCollection ? "USD_COLLECTION_CREDIT" : event === "SUBSIDIARY_ACCOUNT_CHARGE_COMPLETE" ? "WITHDRAWAL_DEBIT" : "ADJUSTMENT",
          amountMinor: ledgerAmountMinor,
          currency: "NGN",
          providerTransactionId: body.externalReferenceNumber as string,
          providerEventId: body.notificationId as string,
          metadata: JSON.parse(JSON.stringify({ event, fee: body.fee ?? null, transactionDate: body.transactionDate })),
        },
      });
      await tx.pagaAccount.update({
        where: { id: account.id },
        data: {
          ...(compensationTransfer ? { lastBalanceMinor: null, lastBalanceSyncedAt: null } : expectedType === "CREDIT" ? { lastBalanceMinor: { increment: amountMinor } } : { lastBalanceMinor: { decrement: ledgerAmountMinor } }),
          ...(!compensationTransfer ? { lastBalanceSyncedAt: new Date() } : {}),
        },
      });
      if (compensationTransfer) await tx.pagaAccount.update({ where: { id: compensationTransfer.destinationAccountId }, data: { lastBalanceMinor: null, lastBalanceSyncedAt: null } });
      if (payout) await tx.pagaPayout.update({ where: { id: payout.id }, data: { chargeCompletedAt: new Date(), failureReason: null } });
      if (usdCollection) await tx.pagaUsdCollection.update({ where: { id: usdCollection.id }, data: { status: "COMPLETED", failureReason: usdCollection.failureReason } });
      if (compensationTransfer) {
        const claimed = await tx.pagaCompensationTransfer.updateMany({ where: { id: compensationTransfer.id, completedAt: null }, data: { completedAt: new Date(), providerTransactionId: body.notificationId as string, failureReason: null } });
        if (claimed.count === 1) {
          await tx.compensationObligation.update({ where: { id: compensationTransfer.obligationId }, data: { status: "PROVIDER_CONFIRMED_PAID", provider: "PAGA", simulated: false, paidAt: new Date(), failureReason: null } });
          const existing = await tx.ledgerEntry.findFirst({ where: { obligationId: compensationTransfer.obligationId, kind: "PROVIDER_SETTLEMENT" }, select: { id: true } });
          if (!existing) await tx.ledgerEntry.create({ data: { obligationId: compensationTransfer.obligationId, kind: "PROVIDER_SETTLEMENT", amount: compensationTransfer.obligation.amount, currency: compensationTransfer.obligation.currency, simulated: false, providerEventId: body.notificationId as string } });
          if (compensationTransfer.obligation.recipientId) await tx.notification.create({ data: { userId: compensationTransfer.obligation.recipientId, title: "Compensation received", body: "Paga confirmed the NGN transfer to your Kintovo Paga account." } });
        }
      }
    });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) {
      console.error("Paga subsidiary operation callback could not be recorded", { accountId: account.id });
      return NextResponse.json({ status: "RETRY" }, { status: 500 });
    }
  }
  if (payout) after(async () => { await startPagaBankTransfer(payout.id); });
  return NextResponse.json({ status: "SUCCESS" });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 32_000) return NextResponse.json({ status: "INVALID" }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }

  if (typeof body.event === "string") return handleOperationNotification(body);

  const suppliedHash = request.headers.get("x-paga-hash-v3") ?? "";
  const parameterHeader = request.headers.get("x-paga-hash-v3-parameters") ?? "";
  const parameterNames = parameterHeader.split(",").map((value) => value.trim());
  if (parameterNames.length !== fundingHashFields.length || parameterNames.some((value, index) => value !== fundingHashFields[index])) {
    return NextResponse.json({ status: "INVALID" }, { status: 401 });
  }

  const transactionDate = body.transactionDate;
  const accountNumber = body.accountNumber;
  const timestamp = body.timestamp;
  const amountLexeme = rawJsonNumber(rawBody, "amount");
  const transactionReference = body.transactionReference;
  if ((transactionReference !== null && typeof transactionReference !== "string") || typeof transactionDate !== "string" || typeof accountNumber !== "string" || typeof timestamp !== "string" || !amountLexeme) {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }

  let config;
  try { config = getPagaConfiguration(); }
  catch { return NextResponse.json({ status: "UNAVAILABLE" }, { status: 503 }); }
  if (!verifyPagaSha512([transactionReference, transactionDate, amountLexeme, accountNumber, timestamp], config.hashKey, suppliedHash)) {
    return NextResponse.json({ status: "INVALID" }, { status: 401 });
  }
  if (body.statusCode !== "0" || typeof body.fundingTransactionReference !== "string" || !body.fundingTransactionReference.trim()) {
    return NextResponse.json({ status: "SUCCESS" });
  }
  const amountMinor = amountToMinor(body.amount);
  if (!amountMinor) return NextResponse.json({ status: "INVALID" }, { status: 400 });

  const account = await db.pagaAccount.findUnique({ where: { accountNumber }, select: { id: true, status: true, currency: true } });
  if (!account || account.status !== "ACTIVE" || account.currency !== "NGN") {
    return NextResponse.json({ status: "UNKNOWN_ACCOUNT" }, { status: 404 });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.pagaAccountLedgerEntry.create({
        data: {
          accountId: account.id,
          reference: body.fundingTransactionReference as string,
          direction: "CREDIT",
          kind: "PROVIDER_FUNDING",
          amountMinor,
          currency: "NGN",
          providerTransactionId: body.fundingTransactionReference as string,
          providerEventId: typeof transactionReference === "string" ? transactionReference : null,
          metadata: JSON.parse(JSON.stringify({ fundingPaymentReference: body.fundingPaymentReference ?? null, payerDetails: body.payerDetails ?? null, narration: body.narration ?? null })),
        },
      });
      await tx.pagaAccount.update({ where: { id: account.id }, data: { lastBalanceMinor: { increment: amountMinor }, lastBalanceSyncedAt: new Date() } });
    });
  } catch (error) {
    // Paga retries with the same transaction reference. A unique conflict means
    // this signed notification was already applied; acknowledge it idempotently.
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) {
      console.error("Paga account funding callback could not be recorded", { accountId: account.id });
      return NextResponse.json({ status: "RETRY" }, { status: 500 });
    }
  }
  return NextResponse.json({ status: "SUCCESS" });
}
