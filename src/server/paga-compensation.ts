import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { transferPagaSubsidiaryAccount } from "@/server/paga";

function asMinor(value: unknown): bigint | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value).replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export async function transferApprovedMilestoneCompensation(obligationId: string) {
  const obligation = await db.compensationObligation.findUnique({
    where: { id: obligationId },
    include: {
      project: { include: { organisation: { include: { pagaAccount: true } } } },
      recipient: { include: { pagaAccount: true } },
      campaignCreator: { include: { campaign: { include: { organisation: { include: { pagaAccount: true } } } } } },
      attribution: { include: { campaignCreator: { include: { campaign: { include: { organisation: { include: { pagaAccount: true } } } } } } },
      pagaTransfer: true,
    },
  });
  if (!obligation || obligation.simulated || obligation.status === "PROVIDER_CONFIRMED_PAID") return;
  if (obligation.currency !== "NGN") {
    await db.compensationObligation.update({ where: { id: obligation.id }, data: { failureReason: "Paga subsidiary-account transfers support NGN only. This obligation needs a supported NGN agreement or a different approved payment rail." } });
    return;
  }
  const organisation = obligation.project?.organisation
    ?? obligation.campaignCreator?.campaign.organisation
    ?? obligation.attribution?.campaignCreator.campaign.organisation;
  const source = organisation?.pagaAccount;
  const destination = obligation.recipient?.pagaAccount;
  if (!source || source.status !== "ACTIVE" || !destination || destination.status !== "ACTIVE") {
    await db.compensationObligation.update({ where: { id: obligation.id }, data: { failureReason: "An active Paga NGN account is required for both the business and recipient before compensation can transfer." } });
    return;
  }

  const amountMinor = BigInt(obligation.amount) * BigInt(100);
  let transfer = obligation.pagaTransfer;
  if (!transfer) {
    transfer = await db.pagaCompensationTransfer.create({
      data: {
        obligationId: obligation.id,
        sourceAccountId: source.id,
        destinationAccountId: destination.id,
        referenceNumber: `KNTTRF${randomBytes(12).toString("hex")}`,
        amountMinor,
      },
    });
  }
  if (transfer.completedAt) return;
  if (transfer.amountMinor !== amountMinor || transfer.sourceAccountId !== source.id || transfer.destinationAccountId !== destination.id) {
    await db.pagaCompensationTransfer.update({ where: { id: transfer.id }, data: { failureReason: "Transfer details no longer match the approved obligation. Finance review is required." } });
    return;
  }

  await db.pagaCompensationTransfer.update({ where: { id: transfer.id }, data: { startedAt: transfer.startedAt ?? new Date(), failureReason: null } });
  try {
    const result = await transferPagaSubsidiaryAccount({
      sourceAccountReference: source.accountReference,
      destinationAccountReference: destination.accountReference,
      referenceNumber: transfer.referenceNumber,
      amountNgn: `${obligation.amount}.00`,
      narration: `Kintovo milestone ${obligation.reference}`.slice(0, 100),
    });
    const responseSource = result.source && typeof result.source === "object" ? result.source as Record<string, unknown> : {};
    const responseDestination = result.destination && typeof result.destination === "object" ? result.destination as Record<string, unknown> : {};
    const valid = String(result.statusCode) === "0"
      && responseSource.accountIdentifier === source.accountReference
      && responseDestination.accountIdentifier === destination.accountReference
      && asMinor(responseSource.amount) === amountMinor
      && asMinor(responseDestination.amount) === amountMinor
      && typeof result.transactionId === "string";
    if (!valid) {
      await db.pagaCompensationTransfer.update({ where: { id: transfer.id }, data: { failureReason: typeof result.statusMessage === "string" ? result.statusMessage.slice(0, 500) : "Paga has not confirmed a matching source and destination transfer. Reconcile using the same reference." } });
      return;
    }
    await confirmTransfer(transfer.id, result.transactionId as string, source.id, destination.id, responseSource.newBalance, responseDestination.newBalance);
  } catch (error) {
    console.error("Paga milestone compensation transfer needs reconciliation", { obligationId, transferId: transfer.id, error });
    await db.pagaCompensationTransfer.update({ where: { id: transfer.id }, data: { failureReason: "Paga transfer result is unconfirmed. Finance must reconcile using the same reference; do not create another transfer." } });
  }
}

async function confirmTransfer(transferId: string, transactionId: string, sourceId: string, destinationId: string, sourceBalance: unknown, destinationBalance: unknown) {
  await db.$transaction(async (tx) => {
    const transfer = await tx.pagaCompensationTransfer.findUnique({ where: { id: transferId }, include: { obligation: true } });
    if (!transfer) return;
    const sourceMinor = asMinor(sourceBalance);
    const destinationMinor = asMinor(destinationBalance);
    if (sourceMinor !== null) await tx.pagaAccount.update({ where: { id: sourceId }, data: { lastBalanceMinor: sourceMinor, lastBalanceSyncedAt: new Date() } });
    if (destinationMinor !== null) await tx.pagaAccount.update({ where: { id: destinationId }, data: { lastBalanceMinor: destinationMinor, lastBalanceSyncedAt: new Date() } });
    if (transfer.completedAt) return;
    const claimed = await tx.pagaCompensationTransfer.updateMany({ where: { id: transferId, completedAt: null }, data: { providerTransactionId: transactionId, completedAt: new Date(), failureReason: null } });
    if (claimed.count !== 1) return;
    await tx.compensationObligation.update({ where: { id: transfer.obligationId }, data: { status: "PROVIDER_CONFIRMED_PAID", provider: "PAGA", simulated: false, paidAt: new Date(), failureReason: null } });
    await tx.ledgerEntry.create({ data: { obligationId: transfer.obligationId, kind: "PROVIDER_SETTLEMENT", amount: transfer.obligation.amount, currency: transfer.obligation.currency, simulated: false, providerEventId: transactionId } });
    if (transfer.obligation.recipientId) await tx.notification.create({ data: { userId: transfer.obligation.recipientId, title: "Compensation received", body: "Paga confirmed the NGN transfer to your Kintovo Paga account." } });
  });
}

export async function reconcilePagaCompensationTransfer(transferId: string) {
  const transfer = await db.pagaCompensationTransfer.findUnique({
    where: { id: transferId },
    include: { sourceAccount: true, destinationAccount: true, obligation: true },
  });
  if (!transfer || transfer.completedAt) return { success: true, message: "This Paga transfer is already confirmed." };
  if (transfer.obligation.status !== "PENDING" || transfer.obligation.currency !== "NGN" || transfer.amountMinor !== BigInt(transfer.obligation.amount) * BigInt(100)) {
    return { success: false, message: "This obligation is not eligible for provider retry." };
  }
  await transferApprovedMilestoneCompensation(transfer.obligationId);
  const updated = await db.pagaCompensationTransfer.findUnique({ where: { id: transferId }, select: { completedAt: true, failureReason: true } });
  return { success: Boolean(updated?.completedAt), message: updated?.completedAt ? "Paga confirmed the compensation transfer." : updated?.failureReason ?? "Paga has not confirmed the transfer; it remains pending." };
}
