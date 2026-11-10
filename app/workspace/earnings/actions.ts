"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

const reviewDelayMs = 24 * 60 * 60 * 1000;

export async function requestWithdrawal(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = z.object({ amount: z.string(), currency: z.enum(["NGN", "USD", "GBP", "EUR"]) }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid withdrawal amount." };
  const amount = Number(parsed.data.amount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2_147_483_647) return { error: "Enter a whole-number amount greater than zero." };
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (!specialist && !creator) return { error: "Withdrawal requests are available to Specialist and Creator accounts." };
  try {
    await db.$transaction(async (tx) => {
      const [obligations, existing] = await Promise.all([
        tx.compensationObligation.findMany({ where: { recipientId: user.id, currency: parsed.data.currency, status: { in: ["SIMULATED_PAID", "PROVIDER_CONFIRMED_PAID", "REFUNDED"] } }, include: { ledgerEntries: true } }),
        tx.withdrawalRequest.findMany({ where: { userId: user.id, currency: parsed.data.currency, status: { in: ["PENDING_REVIEW", "APPROVED"] } }, select: { amount: true } }),
      ]);
      const settled = obligations.reduce((sum, item) => sum + item.ledgerEntries.filter((entry) => ["SIMULATED_SETTLEMENT", "PROVIDER_SETTLEMENT"].includes(entry.kind)).reduce((total, entry) => total + entry.amount, 0), 0);
      const refunded = obligations.reduce((sum, item) => sum + item.ledgerEntries.filter((entry) => ["SIMULATED_REFUND", "PROVIDER_REFUND"].includes(entry.kind)).reduce((total, entry) => total + entry.amount, 0), 0);
      const reserved = existing.reduce((sum, item) => sum + item.amount, 0);
      const available = Math.max(0, settled - refunded - reserved);
      if (amount > available) throw new Error("INSUFFICIENT_AVAILABLE_BALANCE");
      const requestedAt = new Date();
      const request = await tx.withdrawalRequest.create({ data: { userId: user.id, amount, currency: parsed.data.currency, requestedAt, reviewAfter: new Date(requestedAt.getTime() + reviewDelayMs) } });
      await tx.auditLog.create({ data: { actorId: user.id, action: "WITHDRAWAL_REQUESTED", entityType: "WithdrawalRequest", entityId: request.id, metadata: { amount, currency: parsed.data.currency } } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_AVAILABLE_BALANCE") return { error: "This amount exceeds the available balance after refunds and pending withdrawal requests." };
    throw error;
  }
  revalidatePath("/workspace/earnings");
  revalidatePath("/workspace/operations/finance");
  return { success: "Withdrawal request recorded. Operations can review it after the 24-hour review period. No transfer is initiated by this simulated workflow." };
}
