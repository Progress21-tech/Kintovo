"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { getPagaSubsidiaryAccountBalance } from "@/server/paga";
import { ngnToMinor } from "@/server/paga-payouts";

const reviewDelayMs = 24 * 60 * 60 * 1000;

export async function requestWithdrawal(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = z.object({ amount: z.string(), currency: z.literal("NGN") }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid withdrawal amount." };
  const amount = Number(parsed.data.amount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2_147_483_647) return { error: "Enter a whole-number amount greater than zero." };
  const [specialist, creator, account, bank] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.pagaAccount.findUnique({ where: { userId: user.id } }),
    db.pagaBankDestination.findFirst({ where: { userId: user.id, isDefault: true }, select: { id: true } }),
  ]);
  if (!specialist && !creator) return { error: "Withdrawal requests are available to Specialist and Creator accounts." };
  if (!account || account.status !== "ACTIVE") return { error: "Activate your Paga NGN account before requesting a withdrawal." };
  if (!bank) return { error: "Link and validate a Nigerian bank account before requesting a withdrawal." };

  try {
    const balanceResult = await getPagaSubsidiaryAccountBalance(account.accountReference, `KNTBAL${randomBytes(12).toString("hex")}`);
    if (String(balanceResult.statusCode) !== "0") return { error: "Paga could not confirm your current account balance." };
    const balanceMinor = ngnToMinor(balanceResult.balance as number | undefined);
    if (balanceMinor === null) return { error: "Paga returned an invalid account balance." };
    await db.pagaAccount.update({ where: { id: account.id }, data: { lastBalanceMinor: balanceMinor, lastBalanceSyncedAt: new Date() } });
    await db.$transaction(async (tx) => {
      const existing = await tx.withdrawalRequest.findMany({ where: { userId: user.id, currency: "NGN", status: { in: ["PENDING_REVIEW", "APPROVED", "PROCESSING"] } }, select: { amount: true } });
      const reservedMinor = existing.reduce((sum, item) => sum + BigInt(item.amount) * BigInt(100), BigInt(0));
      if (BigInt(amount) * BigInt(100) > balanceMinor - reservedMinor) throw new Error("INSUFFICIENT_AVAILABLE_BALANCE");
      const requestedAt = new Date();
      const request = await tx.withdrawalRequest.create({ data: { userId: user.id, amount, currency: "NGN", pagaBankDestinationId: bank.id, requestedAt, reviewAfter: new Date(requestedAt.getTime() + reviewDelayMs) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "WITHDRAWAL_REQUESTED", entityType: "WithdrawalRequest", entityId: request.id, metadata: { amount, currency: "NGN", source: "PAGA_SUBSIDIARY_ACCOUNT" } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_AVAILABLE_BALANCE") return { error: "The amount exceeds your live Paga balance after pending withdrawal reservations." };
    console.error("Paga withdrawal request could not be created", { userId: user.id, error });
    return { error: "Could not create the withdrawal request. Refresh your Paga balance and try again." };
  }
  revalidatePath("/workspace/earnings");
  revalidatePath("/workspace/operations/finance");
  return { success: "Withdrawal request recorded. Finance can approve it after the 24-hour review period. The Paga balance is reserved until the provider confirms the result." };
}
