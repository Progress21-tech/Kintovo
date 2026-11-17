import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getPagaConfiguration, verifyPagaSha512 } from "@/server/paga";

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
          metadata: { fundingPaymentReference: body.fundingPaymentReference ?? null, payerDetails: body.payerDetails ?? null, narration: body.narration ?? null },
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
