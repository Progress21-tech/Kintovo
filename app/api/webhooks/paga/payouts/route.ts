import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getPagaConfiguration, verifyPagaSha512 } from "@/server/paga";
import { ngnToMinor } from "@/server/paga-payouts";

const payoutHashFields = ["referenceNumber", "transactionDate", "transactionId", "amount", "sessionId"] as const;

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

  const suppliedHash = request.headers.get("x-paga-hash") ?? "";
  const parameterNames = (request.headers.get("x-paga-hash-parameters") ?? "").split(",").map((value) => value.trim());
  if (parameterNames.length !== payoutHashFields.length + 1 || payoutHashFields.some((field, index) => parameterNames[index] !== field) || parameterNames.at(-1) !== "hashKey") {
    return NextResponse.json({ status: "INVALID" }, { status: 401 });
  }
  if (typeof body.referenceNumber !== "string" || typeof body.transactionDate !== "string" || typeof body.transactionId !== "string" || typeof body.amount !== "string" || (body.sessionId !== null && typeof body.sessionId !== "string")) {
    return NextResponse.json({ status: "INVALID" }, { status: 400 });
  }
  let config;
  try { config = getPagaConfiguration(); }
  catch { return NextResponse.json({ status: "UNAVAILABLE" }, { status: 503 }); }
  const signedValues = [body.referenceNumber, body.transactionDate, body.transactionId, body.amount, body.sessionId as string | null];
  if (!verifyPagaSha512(signedValues, config.hashKey, suppliedHash)) return NextResponse.json({ status: "INVALID" }, { status: 401 });

  const payout = await db.pagaPayout.findUnique({ where: { payoutReference: body.referenceNumber }, include: { withdrawalRequest: true } });
  if (!payout) return NextResponse.json({ status: "UNKNOWN_REFERENCE" }, { status: 404 });
  if (payout.withdrawalRequest.status === "PAID") return NextResponse.json({ status: "SUCCESS" });
  const paidAmountMinor = ngnToMinor(body.amount);
  const confirmed = String(body.responseCode) === "0"
    && body.transactionType === "USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED"
    && body.currency === "NGN"
    && !body.reversalId
    && paidAmountMinor === payout.amountMinor;

  if (!confirmed) {
    await db.pagaPayout.update({ where: { id: payout.id }, data: { payoutTransactionId: body.transactionId, failureReason: String(body.responseCode) === "0" ? "Paga callback did not match the expected settled NGN payout. Reconcile in Paga before releasing the reserved balance." : typeof body.message === "string" ? body.message.slice(0, 500) : "Paga reported a non-settled payout. Finance reconciliation is required." } });
    return NextResponse.json({ status: "SUCCESS" });
  }

  const completedAt = new Date(body.transactionDate);
  await db.$transaction(async (tx) => {
    const changed = await tx.withdrawalRequest.updateMany({ where: { id: payout.withdrawalRequestId, status: "PROCESSING" }, data: { status: "PAID" } });
    if (changed.count !== 1) return;
    await tx.pagaPayout.update({ where: { id: payout.id }, data: { payoutTransactionId: body.transactionId as string, payoutCompletedAt: Number.isNaN(completedAt.getTime()) ? new Date() : completedAt, failureReason: null } });
    await tx.notification.create({ data: { userId: payout.withdrawalRequest.userId, title: "Withdrawal paid", body: "Paga confirmed that your bank payout settled." } });
  });
  return NextResponse.json({ status: "SUCCESS" });
}
