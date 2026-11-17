"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { createPagaUsdCollection } from "@/server/paga";
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
        requestedNgnMinor: BigInt(parsed.data.amountNgn) * 100n,
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
