"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { createPagaUsdCollection, getPagaUsdCollectionStatus, topUpPagaSubsidiaryAccount } from "@/server/paga";
import { ensurePagaOrganisationAccount } from "@/server/paga-accounts";

const usdFundingSchema = z.object({
  amountNgn: z.coerce.number().int().min(1000).max(1_000_000_000),
  payerPhoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Enter a phone number with country code, for example +19175247723."),
});

export async function createUsdFundingRequest(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const parsed = usdFundingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the funding details." };

  const membership = await db.organisationMembership.findFirst({
    where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } },
    include: { organisation: { select: { id: true, name: true } } },
  });
  if (!membership) return { error: "Only an organisation owner or administrator can request business funding." };

  try {
    const account = await ensurePagaOrganisationAccount(membership.organisation.id);
    if (account.status !== "ACTIVE" || !account.accountNumber) return { error: "The organisation's Paga Sandbox account is not active yet. Complete Paga account setup first." };

    const callbackUrl = process.env.PAGA_USD_COLLECTION_CALLBACK_URL?.trim();
    if (!callbackUrl || !callbackUrl.startsWith("https://")) return { error: "Set PAGA_USD_COLLECTION_CALLBACK_URL to the public HTTPS URL ending in /api/webhooks/paga/usd." };
    const referenceNumber = `KNTUSD${randomBytes(16).toString("hex")}`;
    const topUpReference = `KNTTOPUP${randomBytes(12).toString("hex")}`;
    const payment = await db.pagaUsdCollection.create({
      data: {
        accountId: account.id,
        referenceNumber,
        topUpReference,
        requestedNgnMinor: BigInt(parsed.data.amountNgn) * BigInt(100),
        status: "REQUESTED",
      },
    });

    try {
      const response = await createPagaUsdCollection({
        referenceNumber,
        amountNgn: String(parsed.data.amountNgn),
        payerName: user.name,
        payerPhoneNumber: parsed.data.payerPhoneNumber,
        payerEmail: user.email,
        payeeName: membership.organisation.name,
        callbackUrl,
      });
      if (String(response.statusCode) !== "0") {
        const reason = typeof response.statusMessage === "string" ? response.statusMessage.slice(0, 300) : "Paga did not accept the funding request.";
        await db.pagaUsdCollection.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason, responseData: JSON.parse(JSON.stringify(response)) } });
        return { error: "Paga could not create the USD funding instructions. Review the payment request and try again." };
      }
      await db.pagaUsdCollection.update({ where: { id: payment.id }, data: { responseData: JSON.parse(JSON.stringify(response)) } });
    } catch {
      await db.pagaUsdCollection.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Paga request failed before instructions were confirmed." } });
      return { error: "Paga Sandbox did not confirm the funding request. Check the account setup and try again." };
    }
    revalidatePath("/workspace/funding");
    return { success: `USD payment instructions created. Reference: ${referenceNumber}` };
  } catch (error) {
    console.error("Paga USD funding request could not be created", { organisationId: membership.organisation.id, error });
    return { error: "Paga Sandbox is not ready for USD collection. Check the server configuration and try again." };
  }
}

export async function retryPagaAccountProvisioning(_state: { error?: string; success?: string }, _formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const membership = await db.organisationMembership.findFirst({ where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } }, select: { organisationId: true } });
  if (!membership) return { error: "Only an organisation owner or administrator can manage the Paga account." };
  try {
    const account = await ensurePagaOrganisationAccount(membership.organisationId);
    revalidatePath("/workspace/funding");
    if (account.status !== "ACTIVE") return { error: account.provisioningError ?? "Paga Sandbox account setup is not enabled for this deployment yet." };
    return { success: "Paga confirmed the organisation account is active." };
  } catch (error) {
    console.error("Paga organisation account retry failed", { organisationId: membership.organisationId, error });
    return { error: "Paga Sandbox account provisioning failed. Check the server configuration and try again." };
  }
}

export async function verifyUsdFundingRequest(_state: { error?: string; success?: string }, formData: FormData): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const reference = z.string().min(1).max(80).safeParse(formData.get("referenceNumber"));
  if (!reference.success) return { error: "Funding reference is invalid." };
  const membership = await db.organisationMembership.findFirst({ where: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } }, select: { organisationId: true } });
  if (!membership) return { error: "Only an organisation owner or administrator can verify business funding." };
  const payment = await db.pagaUsdCollection.findFirst({ where: { referenceNumber: reference.data, account: { organisationId: membership.organisationId } }, include: { account: { select: { accountReference: true, status: true } } } });
  if (!payment) return { error: "That funding request was not found in this business workspace." };
  if (payment.status === "COMPLETED") return { success: "Paga and Kintovo already confirmed this funding request." };
  if (["FAILED", "FUNDING_FAILED"].includes(payment.status)) return { error: "Paga marked this request as failed. Contact Finance before creating another request." };
  try {
    const result = await getPagaUsdCollectionStatus(payment.referenceNumber);
    if (String(result.statusCode) !== "0" || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
      return { error: "Paga could not confirm this request yet. Try again later." };
    }
    const data = result.data as Record<string, unknown>;
    const paid = String(data.statusCode) === "0";
    const pending = String(data.statusCode) === "1";
    if (!paid && !pending) return { error: typeof data.statusMessage === "string" ? `Paga status: ${data.statusMessage}` : "Paga reports that this payment has not completed." };
    if (!paid) return { success: "Paga confirms the funding request is still pending. Kintovo has not credited the account." };
    if (payment.status === "TOP_UP_PENDING" && payment.creditedAmountMinor && payment.account.status === "ACTIVE") {
      const amountNgn = (Number(payment.creditedAmountMinor) / 100).toFixed(2);
      const topUp = await topUpPagaSubsidiaryAccount({ accountReference: payment.account.accountReference, referenceNumber: payment.topUpReference, amountNgn, narration: `USD collection ${payment.referenceNumber}`.slice(0, 100) });
      if (String(topUp.statusCode) !== "0") return { error: typeof topUp.statusMessage === "string" ? topUp.statusMessage : "Paga has not confirmed the NGN account top-up. Keep the request open and retry status later." };
      return { success: "Paga confirmed the payment and accepted the idempotent account top-up retry. Waiting for its signed account callback." };
    }
    await db.pagaUsdCollection.update({
      where: { id: payment.id },
      data: {
        status: payment.status === "REQUESTED" ? "CAPTURED" : payment.status,
        ...(typeof data.paymentId === "string" ? { paymentId: data.paymentId } : {}),
      },
    });
    revalidatePath("/workspace/funding");
    return { success: "Paga confirms the payment was captured. Kintovo is waiting for the callback’s conversion details before crediting the NGN account." };
  } catch (error) {
    console.error("Paga USD payment status check failed", { referenceNumber: payment.referenceNumber, error });
    return { error: "Could not check this funding request with Paga. Try again later." };
  }
}
