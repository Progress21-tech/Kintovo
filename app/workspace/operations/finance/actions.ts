"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { createSimulatedSettlement } from "@/server/payments";

async function requireFinance() {
  const user = await requireUser();
  if (!["ADMIN", "FINANCE"].includes(user.platformRole)) redirect("/workspace");
  return user;
}

export async function simulateSettlement(formData: FormData) {
  const user = await requireFinance();
  const id = z.string().min(1).safeParse(formData.get("obligationId"));
  if (!id.success) return;
  const obligation = await db.compensationObligation.findUnique({ where: { id: id.data } });
  if (!obligation || !obligation.simulated || !["PENDING", "FAILED"].includes(obligation.status)) return;
  const result = createSimulatedSettlement();
  await db.$transaction(async (tx) => {
    const changed = await tx.compensationObligation.updateMany({ where: { id: obligation.id, status: { in: ["PENDING", "FAILED"] }, simulated: true }, data: { status: result.status, provider: result.provider, paidAt: result.paidAt, failureReason: null } });
    if (changed.count !== 1) return;
    await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "SIMULATED_SETTLEMENT", amount: obligation.amount, currency: obligation.currency, simulated: true, providerEventId: result.eventId } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_SIMULATED_SETTLEMENT_RECORDED", entityType: "CompensationObligation", entityId: obligation.id, metadata: { eventId: result.eventId } } });
  });
  revalidatePath("/workspace/operations/finance"); revalidatePath("/workspace/payments");
}

export async function simulateFailure(formData: FormData) {
  const user = await requireFinance();
  const input = z.object({ obligationId: z.string().min(1), reason: z.string().trim().min(4).max(300) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const obligation = await db.compensationObligation.findUnique({ where: { id: input.data.obligationId } });
  if (!obligation || !obligation.simulated || !["PENDING", "FAILED"].includes(obligation.status)) return;
  await db.$transaction(async (tx) => {
    const changed = await tx.compensationObligation.updateMany({ where: { id: obligation.id, status: { in: ["PENDING", "FAILED"] }, simulated: true }, data: { status: "FAILED", failureReason: input.data.reason } });
    if (changed.count !== 1) return;
    await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "SIMULATED_FAILURE", amount: 0, currency: obligation.currency, simulated: true, providerEventId: `mock_failure_${Date.now()}` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_SIMULATED_FAILURE_RECORDED", entityType: "CompensationObligation", entityId: obligation.id } });
  });
  revalidatePath("/workspace/operations/finance"); revalidatePath("/workspace/payments");
}

export async function simulateRefund(formData: FormData) {
  const user = await requireFinance();
  const input = z.object({ obligationId: z.string().min(1), reason: z.string().trim().min(8).max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const obligation = await db.compensationObligation.findUnique({ where: { id: input.data.obligationId }, include: { ledgerEntries: true } });
  if (!obligation || obligation.status !== "SIMULATED_PAID" || !obligation.simulated) return;
  const settled = obligation.ledgerEntries.filter((entry) => entry.kind === "SIMULATED_SETTLEMENT").reduce((sum, entry) => sum + entry.amount, 0);
  const alreadyRefunded = obligation.ledgerEntries.filter((entry) => entry.kind === "SIMULATED_REFUND").reduce((sum, entry) => sum + entry.amount, 0);
  const refund = Math.max(0, settled - alreadyRefunded);
  if (!refund) return;
  await db.$transaction(async (tx) => {
    const changed = await tx.compensationObligation.updateMany({ where: { id: obligation.id, status: "SIMULATED_PAID", simulated: true }, data: { status: "REFUNDED", failureReason: input.data.reason } });
    if (changed.count !== 1) return;
    await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "SIMULATED_REFUND", amount: refund, currency: obligation.currency, simulated: true, providerEventId: `mock_refund_${obligation.id}` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_SIMULATED_REFUND_RECORDED", entityType: "CompensationObligation", entityId: obligation.id, metadata: { amount: refund, reason: input.data.reason } } });
  });
  revalidatePath("/workspace/operations/finance"); revalidatePath("/workspace/payments");
}

export async function adjustObligation(formData: FormData) {
  const user = await requireFinance();
  const input = z.object({ obligationId: z.string().min(1), newAmount: z.string(), reason: z.string().trim().min(8).max(1000) }).safeParse(Object.fromEntries(formData.entries()));
  if (!input.success) return;
  const newAmount = Number(input.data.newAmount);
  if (!Number.isSafeInteger(newAmount) || newAmount < 0 || newAmount > 2_147_483_647) return;
  const obligation = await db.compensationObligation.findUnique({ where: { id: input.data.obligationId } });
  if (!obligation || !obligation.simulated || !["PENDING", "FAILED"].includes(obligation.status) || newAmount === obligation.amount) return;
  const delta = newAmount - obligation.amount;
  await db.$transaction(async (tx) => {
    const changed = await tx.compensationObligation.updateMany({ where: { id: obligation.id, amount: obligation.amount, status: { in: ["PENDING", "FAILED"] }, simulated: true }, data: { amount: newAmount, failureReason: input.data.reason } });
    if (changed.count !== 1) return;
    await tx.ledgerEntry.create({ data: { obligationId: obligation.id, kind: "ADJUSTMENT", amount: delta, currency: obligation.currency, simulated: true, providerEventId: `adjust_${Date.now()}_${obligation.id}` } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_OBLIGATION_ADJUSTED", entityType: "CompensationObligation", entityId: obligation.id, metadata: { delta, reason: input.data.reason } } });
  });
  revalidatePath("/workspace/operations/finance"); revalidatePath("/workspace/payments");
}

export async function reconcileLedger() {
  const user = await requireFinance();
  const obligations = await db.compensationObligation.findMany({ include: { ledgerEntries: true }, orderBy: { createdAt: "asc" }, take: 1000 });
  const exceptions = obligations.filter((item) => {
    const settled = item.ledgerEntries.filter((entry) => ["SIMULATED_SETTLEMENT", "PROVIDER_SETTLEMENT"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    const refunded = item.ledgerEntries.filter((entry) => ["SIMULATED_REFUND", "PROVIDER_REFUND"].includes(entry.kind)).reduce((sum, entry) => sum + entry.amount, 0);
    return settled - refunded < 0 || (item.status === "SIMULATED_PAID" && settled === 0) || (item.status === "REFUNDED" && settled <= refunded);
  });
  await db.auditLog.create({ data: { actorId: user.id, action: "PAYMENT_LEDGER_RECONCILED", entityType: "CompensationLedger", entityId: "global", metadata: { obligationsChecked: obligations.length, exceptions: exceptions.map((item) => item.reference) } } });
  revalidatePath("/workspace/operations/finance");
}
