import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { chargePagaSubsidiaryAccount, depositPagaToBank, getPagaBankTransferStatus, getPagaSubsidiaryAccountBalance } from "@/server/paga";
import { decryptPagaBankAccountNumber } from "@/server/paga-bank-vault";

function newReference(prefix: "KNTCHG" | "KNTPAY") {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

function minorToNgn(amountMinor: bigint) {
  const hundred = BigInt(100);
  const whole = amountMinor / hundred;
  const fraction = (amountMinor % hundred).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function ngnToMinor(amount: unknown) {
  if (typeof amount !== "string" && typeof amount !== "number") return null;
  const text = String(amount).replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  try { return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); } catch { return null; }
}

export async function approvePagaWithdrawal(input: { requestId: string; reviewerId: string; note: string }) {
  const callbackUrl = process.env.PAGA_PAYOUT_CALLBACK_URL?.trim();
  try {
    if (!callbackUrl || new URL(callbackUrl).protocol !== "https:") throw new Error("PAGA_PAYOUT_CALLBACK_URL must be a public HTTPS URL ending in /api/webhooks/paga/payouts.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("PAGA_PAYOUT_CALLBACK_URL")) throw error;
    throw new Error("PAGA_PAYOUT_CALLBACK_URL must be a public HTTPS URL ending in /api/webhooks/paga/payouts.");
  }

  const request = await db.withdrawalRequest.findUnique({
    where: { id: input.requestId },
    include: { user: { include: { pagaAccount: true } }, pagaBankDestination: true, pagaPayout: true },
  });
  if (!request || request.status !== "PENDING_REVIEW" || request.reviewAfter > new Date()) throw new Error("This withdrawal is no longer awaiting an eligible review.");
  if (request.currency !== "NGN") throw new Error("Paga bank payouts are currently available only in NGN.");
  const account = request.user.pagaAccount;
  const bank = request.pagaBankDestination;
  if (!account || account.status !== "ACTIVE" || !account.accountNumber) throw new Error("The user needs an active Paga account before payout approval.");
  if (!bank || !bank.validatedAt) throw new Error("The user needs a Paga-validated default bank account before payout approval.");
  // Confirm the stored ciphertext can be opened before taking funds from the user's Paga balance.
  decryptPagaBankAccountNumber(bank.accountNumberCipher);

  const balanceResult = await getPagaSubsidiaryAccountBalance(account.accountReference, newReference("KNTCHG"));
  if (String(balanceResult.statusCode) !== "0") throw new Error("Paga could not confirm the user's current NGN balance.");
  const balanceMinor = ngnToMinor(balanceResult.balance as number | undefined);
  if (balanceMinor === null) throw new Error("Paga returned an invalid account balance.");
  await db.pagaAccount.update({ where: { id: account.id }, data: { lastBalanceMinor: balanceMinor, lastBalanceSyncedAt: new Date() } });

  const chargeReference = request.pagaPayout?.chargeReference ?? newReference("KNTCHG");
  const payoutReference = request.pagaPayout?.payoutReference ?? newReference("KNTPAY");
  const payoutAmountMinor = BigInt(request.amount) * BigInt(100);
  const payout = await db.$transaction(async (tx) => {
    const fresh = await tx.withdrawalRequest.findUnique({ where: { id: request.id }, select: { id: true, userId: true, amount: true, currency: true, status: true, reviewAfter: true } });
    if (!fresh || fresh.status !== "PENDING_REVIEW" || fresh.reviewAfter > new Date()) throw new Error("This withdrawal has already been reviewed.");
    const reservations = await tx.withdrawalRequest.findMany({ where: { userId: request.userId, currency: "NGN", status: { in: ["PENDING_REVIEW", "APPROVED", "PROCESSING"] }, id: { not: request.id } }, select: { amount: true } });
    const reservedMinor = reservations.reduce((sum, item) => sum + BigInt(item.amount) * BigInt(100), BigInt(0));
    if (payoutAmountMinor > balanceMinor - reservedMinor) throw new Error("The Paga balance no longer covers this withdrawal after other reserved requests.");
    const changed = await tx.withdrawalRequest.updateMany({ where: { id: request.id, status: "PENDING_REVIEW", reviewAfter: { lte: new Date() } }, data: { status: "PROCESSING", reviewedAt: new Date(), reviewerId: input.reviewerId, reviewNote: input.note } });
    if (changed.count !== 1) throw new Error("This withdrawal has already been reviewed.");
    const current = await tx.pagaPayout.findUnique({ where: { withdrawalRequestId: request.id } });
    const created = current ?? await tx.pagaPayout.create({ data: { withdrawalRequestId: request.id, accountId: account.id, bankDestinationId: bank.id, currency: "NGN", amountMinor: payoutAmountMinor, chargeReference, payoutReference, chargeStartedAt: new Date() } });
    await tx.notification.create({ data: { userId: request.userId, title: "Withdrawal approved and processing", body: "Finance approved your withdrawal. Paga is processing the bank transfer; the balance remains reserved until Paga confirms the result." } });
    await tx.auditLog.create({ data: { actorId: input.reviewerId, action: "PAGA_WITHDRAWAL_PROCESSING_STARTED", entityType: "WithdrawalRequest", entityId: request.id, metadata: { amount: request.amount, currency: request.currency, payoutReference: created.payoutReference } } });
    return created;
  }, { isolationLevel: "Serializable" });

  if (payout.chargeCompletedAt) {
    await startPagaBankTransfer(payout.id);
    return;
  }

  try {
    const charge = await chargePagaSubsidiaryAccount({ accountReference: account.accountReference, referenceNumber: payout.chargeReference, amountNgn: minorToNgn(payoutAmountMinor), narration: `Approved withdrawal ${request.id}`.slice(0, 100) });
    if (String(charge.statusCode) !== "0") {
      await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: typeof charge.statusMessage === "string" ? charge.statusMessage.slice(0, 500) : "Paga has not confirmed the subsidiary-account charge. Reconcile before retrying." } });
      return;
    }
    await db.pagaPayout.update({ where: { id: payout.id }, data: { chargeCompletedAt: new Date(), chargeTransactionId: typeof charge.transactionId === "string" ? charge.transactionId : null, failureReason: null } });
    await startPagaBankTransfer(payout.id);
  } catch (error) {
    console.error("Paga withdrawal charge needs reconciliation", { payoutId: payout.id, error });
    await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: "Paga charge result is unconfirmed. Check the Paga callback or transaction record before retrying." } });
  }
}

export async function startPagaBankTransfer(payoutId: string) {
  const payout = await db.pagaPayout.findUnique({
    where: { id: payoutId },
    include: { withdrawalRequest: { select: { id: true, status: true } }, bankDestination: true },
  });
  if (!payout || payout.withdrawalRequest.status !== "PROCESSING" || !payout.chargeCompletedAt || payout.payoutTransactionId) return;
  const callbackUrl = process.env.PAGA_PAYOUT_CALLBACK_URL?.trim();
  try {
    if (!callbackUrl || new URL(callbackUrl).protocol !== "https:") throw new Error("PAGA_PAYOUT_CALLBACK_URL must be a public HTTPS URL ending in /api/webhooks/paga/payouts.");
  } catch (error) {
    await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: error instanceof Error ? error.message : "Payout callback URL is invalid." } });
    return;
  }
  const claimed = await db.pagaPayout.updateMany({ where: { id: payout.id, payoutStartedAt: null, payoutTransactionId: null }, data: { payoutStartedAt: new Date(), failureReason: null } });
  if (claimed.count !== 1) return;
  try {
    const accountNumber = decryptPagaBankAccountNumber(payout.bankDestination.accountNumberCipher);
    const result = await depositPagaToBank({
      referenceNumber: payout.payoutReference,
      amountNgn: minorToNgn(payout.amountMinor),
      bankPublicId: payout.bankDestination.bankPublicId,
      accountNumber,
      callbackUrl,
    });
    if (Number(result.responseCode) === 0) {
      await db.pagaPayout.update({ where: { id: payout.id }, data: { payoutTransactionId: typeof result.transactionId === "string" ? result.transactionId : null, failureReason: null } });
    } else {
      await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: typeof result.message === "string" ? result.message.slice(0, 500) : "Paga has not confirmed the bank transfer. Reconcile before retrying." } });
    }
  } catch (error) {
    console.error("Paga bank payout submission needs reconciliation", { payoutId: payout.id, error });
    await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: "Paga bank-transfer result is unconfirmed. Check transaction status before retrying." } });
  }
}

export async function reconcilePagaBankTransfer(payoutId: string, reviewerId: string) {
  let payout = await db.pagaPayout.findUnique({ where: { id: payoutId }, include: { withdrawalRequest: true, account: true } });
  if (!payout || payout.withdrawalRequest.status !== "PROCESSING") throw new Error("This payout is not ready for provider reconciliation.");
  if (!payout.chargeCompletedAt) {
    // Paga documents retries with the same subsidiary-operation reference as idempotent.
    // Never mint a new charge reference while the result of the first call is uncertain.
    const retriedCharge = await chargePagaSubsidiaryAccount({ accountReference: payout.account.accountReference, referenceNumber: payout.chargeReference, amountNgn: minorToNgn(payout.amountMinor), narration: `Approved withdrawal ${payout.withdrawalRequestId}`.slice(0, 100) });
    if (String(retriedCharge.statusCode) !== "0") {
      const message = typeof retriedCharge.statusMessage === "string" ? retriedCharge.statusMessage.slice(0, 500) : "Paga has not confirmed the account charge. Keep the withdrawal reserved and wait for its callback.";
      await db.pagaPayout.update({ where: { id: payout.id }, data: { failureReason: message } });
      return { confirmed: false, message };
    }
    payout = await db.pagaPayout.update({ where: { id: payout.id }, data: { chargeCompletedAt: new Date(), chargeTransactionId: typeof retriedCharge.transactionId === "string" ? retriedCharge.transactionId : null, failureReason: null }, include: { withdrawalRequest: true, account: true } });
  }
  if (!payout.payoutStartedAt) {
    await startPagaBankTransfer(payout.id);
    return { confirmed: false, message: "Paga confirmed the subsidiary-account charge. The bank transfer has been submitted or is being reconciled." };
  }
  const status = await getPagaBankTransferStatus(payout.payoutReference);
  if (Number(status.responseCode) !== 0) throw new Error(typeof status.message === "string" ? status.message : "Paga could not confirm this transaction status.");
  const amountMinor = ngnToMinor(status.amount as string | number | undefined);
  if (status.transactionType !== "USER_SEND_CASH_TO_BANK_ACCOUNT_SETTLED" || status.currency !== "NGN" || status.reversalId || amountMinor !== payout.amountMinor) {
    return { confirmed: false, message: "Paga has not confirmed a matching settled bank payout. The balance remains reserved; do not send a second payout." };
  }
  const completedAt = typeof status.dateUTC === "number" && Number.isFinite(status.dateUTC) ? new Date(status.dateUTC) : new Date();
  const changed = await db.$transaction(async (tx) => {
    const result = await tx.withdrawalRequest.updateMany({ where: { id: payout.withdrawalRequestId, status: "PROCESSING" }, data: { status: "PAID" } });
    if (result.count !== 1) return 0;
    await tx.pagaPayout.update({ where: { id: payout.id }, data: { payoutTransactionId: typeof status.transactionId === "string" ? status.transactionId : payout.payoutTransactionId, payoutCompletedAt: completedAt, failureReason: null } });
    await tx.notification.create({ data: { userId: payout.withdrawalRequest.userId, title: "Withdrawal paid", body: "Paga confirmed that your bank payout settled." } });
    await tx.auditLog.create({ data: { actorId: reviewerId, action: "PAGA_WITHDRAWAL_CONFIRMED_BY_STATUS", entityType: "WithdrawalRequest", entityId: payout.withdrawalRequestId, metadata: { payoutReference: payout.payoutReference, transactionId: status.transactionId ?? null } } });
    return result.count;
  });
  return { confirmed: changed === 1, message: changed === 1 ? "Paga confirmed the bank payout." : "This withdrawal was already updated." };
}
