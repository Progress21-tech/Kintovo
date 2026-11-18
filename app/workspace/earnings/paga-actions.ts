"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { getPagaBanks, getPagaSubsidiaryAccountBalance, validatePagaBankAccount } from "@/server/paga";
import { encryptPagaBankAccountNumber } from "@/server/paga-bank-vault";
import { ensurePagaUserAccount } from "@/server/paga-accounts";

async function requireTalentAccount() {
  const user = await requireUser();
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  if (!specialist && !creator) throw new Error("Paga wallet settings are available to Creator and Specialist accounts.");
  return user;
}

export async function getPagaBankOptions() {
  await requireTalentAccount();
  try {
    const result = await getPagaBanks(`KNTBANK${randomBytes(12).toString("hex")}`);
    if (String(result.responseCode) !== "0" || !Array.isArray(result.banks)) return { error: "Paga could not return the bank list. Try again." };
    const banks = result.banks.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const bank = item as Record<string, unknown>;
      return typeof bank.uuid === "string" && typeof bank.name === "string" ? [{ uuid: bank.uuid, name: bank.name }] : [];
    });
    return { banks };
  } catch (error) {
    console.error("Paga bank list could not be loaded", { error });
    return { error: "Paga bank list is unavailable. Check Sandbox setup and try again." };
  }
}

export async function retryPagaUserAccount(_state: { error?: string; success?: string }, _formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireTalentAccount();
  try {
    const account = await ensurePagaUserAccount(user.id);
    revalidatePath("/workspace/earnings");
    if (account.status !== "ACTIVE" || !account.accountNumber) return { error: account.provisioningError ?? "Paga Sandbox has not confirmed this account yet." };
    return { success: "Paga confirmed your NGN account." };
  } catch (error) {
    console.error("Paga user account retry failed", { userId: user.id, error });
    return { error: "Paga Sandbox account provisioning failed. Check the server configuration and try again." };
  }
}

export async function refreshPagaUserBalance(_state: { error?: string; success?: string }, _formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireTalentAccount();
  const account = await db.pagaAccount.findUnique({ where: { userId: user.id } });
  if (!account || account.status !== "ACTIVE" || !account.accountNumber) return { error: "Create and activate your Paga account first." };
  try {
    const result = await getPagaSubsidiaryAccountBalance(account.accountReference, `KNTBAL${randomBytes(12).toString("hex")}`);
    const balance = result.balance;
    if (String(result.statusCode) !== "0" || typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) {
      return { error: "Paga did not return a valid balance. Try again." };
    }
    await db.pagaAccount.update({ where: { id: account.id }, data: { lastBalanceMinor: BigInt(Math.round(balance * 100)), lastBalanceSyncedAt: new Date() } });
    revalidatePath("/workspace/earnings");
    return { success: "Your Paga balance was refreshed." };
  } catch (error) {
    console.error("Paga user balance refresh failed", { userId: user.id, error });
    return { error: "Could not refresh the Paga balance. Check Sandbox setup and try again." };
  }
}

export async function savePagaBankDestination(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireTalentAccount();
  const parsed = z.object({ bankPublicId: z.string().uuid(), accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter a 10-digit Nigerian bank account number.") }).safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the bank details." };
  const account = await db.pagaAccount.findUnique({ where: { userId: user.id }, select: { status: true } });
  if (account?.status !== "ACTIVE") return { error: "Your Paga account must be active before linking a bank account." };
  try {
    const banksResult = await getPagaBanks(`KNTBANK${randomBytes(12).toString("hex")}`);
    const banks = Array.isArray(banksResult.banks) ? banksResult.banks : [];
    const selected = banks.find((item) => item && typeof item === "object" && !Array.isArray(item) && (item as Record<string, unknown>).uuid === parsed.data.bankPublicId) as Record<string, unknown> | undefined;
    if (String(banksResult.responseCode) !== "0" || typeof selected?.name !== "string") return { error: "Select a bank from Paga's current bank list." };

    const validation = await validatePagaBankAccount({
      referenceNumber: `KNTVAL${randomBytes(12).toString("hex")}`,
      amountNgn: "100.00",
      bankPublicId: parsed.data.bankPublicId,
      accountNumber: parsed.data.accountNumber,
    });
    if (Number(validation.responseCode) !== 0 || typeof validation.destinationAccountHolderNameAtBank !== "string" || !validation.destinationAccountHolderNameAtBank.trim()) {
      return { error: typeof validation.message === "string" ? validation.message : "Paga could not validate that bank account." };
    }

    const encrypted = encryptPagaBankAccountNumber(parsed.data.accountNumber);
    const last4 = parsed.data.accountNumber.slice(-4);
    await db.$transaction(async (tx) => {
      await tx.pagaBankDestination.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
      const reusable = await tx.pagaBankDestination.findFirst({ where: { userId: user.id, bankPublicId: parsed.data.bankPublicId, accountNumberLast4: last4, payouts: { none: {} } } });
      if (reusable) {
        await tx.pagaBankDestination.update({ where: { id: reusable.id }, data: { bankName: selected.name as string, accountNumberCipher: encrypted, accountHolderName: validation.destinationAccountHolderNameAtBank.trim(), validatedAt: new Date(), isDefault: true } });
      } else {
        await tx.pagaBankDestination.create({ data: { userId: user.id, bankPublicId: parsed.data.bankPublicId, bankName: selected.name as string, accountNumberCipher: encrypted, accountNumberLast4: last4, accountHolderName: validation.destinationAccountHolderNameAtBank.trim(), validatedAt: new Date(), isDefault: true } });
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: "PAGA_BANK_DESTINATION_VALIDATED", entityType: "User", entityId: user.id, metadata: { bankName: selected.name, accountNumberLast4: last4 } } });
    });
    revalidatePath("/workspace/earnings");
    return { success: `Paga validated and linked the bank account for ${validation.destinationAccountHolderNameAtBank.trim()}.` };
  } catch (error) {
    console.error("Paga bank destination validation failed", { userId: user.id, error });
    return { error: error instanceof Error && error.message.includes("PAGA_BANK_ENCRYPTION_KEY") ? error.message : "Could not validate or save the bank account. Check Paga Sandbox setup and try again." };
  }
}
