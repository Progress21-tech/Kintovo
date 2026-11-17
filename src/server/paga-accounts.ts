import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { createPagaSubsidiaryAccount, getPagaSubsidiaryAccount } from "@/server/paga";

type AccountOwner =
  | { kind: "user"; id: string }
  | { kind: "organisation"; id: string };

function makeReference(prefix: "USR" | "ORG") {
  return `KNT${prefix}${randomBytes(10).toString("hex")}`;
}

function nameParts(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "Kintovo", lastName: parts.slice(1).join(" ") || "User" };
}

async function provision(owner: AccountOwner, contact: { name: string; email: string; phone?: string | null }) {
  const where = owner.kind === "user" ? { userId: owner.id } : { organisationId: owner.id };
  let account = await db.pagaAccount.findFirst({ where });
  if (!account) {
    const prefix = owner.kind === "user" ? "USR" : "ORG";
    try {
      account = await db.pagaAccount.create({
        data: {
          ...where,
          accountReference: makeReference(prefix),
          provisioningReference: `KNT-PROV-${randomBytes(12).toString("hex")}`,
          currency: "NGN",
          status: "PENDING",
        },
      });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
      account = await db.pagaAccount.findFirst({ where });
      if (!account) throw error;
    }
  }

  if (account.status === "ACTIVE" && account.accountNumber) return account;
  if (process.env.PAGA_ENABLE_SANDBOX !== "true") return account;

  const callbackUrl = process.env.PAGA_ACCOUNT_CALLBACK_URL?.trim();
  let callbackIsHttps = false;
  try { callbackIsHttps = new URL(callbackUrl ?? "").protocol === "https:"; } catch { /* invalid URL */ }
  if (!callbackUrl || !callbackIsHttps) {
    return db.pagaAccount.update({ where: { id: account.id }, data: { provisioningError: "PAGA_ACCOUNT_CALLBACK_URL must be configured as a public HTTPS URL." } });
  }

  try {
    const { firstName, lastName } = nameParts(contact.name);
    let response = await createPagaSubsidiaryAccount({
      referenceNumber: account.provisioningReference,
      accountReference: account.accountReference,
      accountName: owner.kind === "organisation" ? contact.name : contact.name,
      firstName,
      lastName,
      phoneNumber: contact.phone ?? undefined,
      email: contact.email,
    callbackUrl,
    });

    // A retry after a network timeout can return Paga's duplicate code. Retrieve
    // the original account instead of issuing a new account reference.
    if (String(response.statusCode) === "102") {
      response = await getPagaSubsidiaryAccount(account.accountReference, account.provisioningReference);
    }
    if (String(response.statusCode) !== "0" || typeof response.accountNumber !== "string") {
      const providerMessage = typeof response.statusMessage === "string" ? response.statusMessage : "Paga did not confirm account creation.";
      return db.pagaAccount.update({ where: { id: account.id }, data: { status: "FAILED", provisioningError: providerMessage.slice(0, 500) } });
    }
    const balance = typeof response.balance === "number" && Number.isFinite(response.balance)
      ? BigInt(Math.round(response.balance * 100))
      : null;
    return db.pagaAccount.update({
      where: { id: account.id },
      data: { accountNumber: response.accountNumber, status: "ACTIVE", provisioningError: null, ...(balance !== null ? { lastBalanceMinor: balance, lastBalanceSyncedAt: new Date() } : {}) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paga account provisioning failed.";
    return db.pagaAccount.update({ where: { id: account.id }, data: { status: "FAILED", provisioningError: message.slice(0, 500) } });
  }
}

export async function ensurePagaUserAccount(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true } });
  if (!user) throw new Error("Cannot provision a Paga account for an unknown user.");
  return provision({ kind: "user", id: user.id }, user);
}

export async function ensurePagaOrganisationAccount(organisationId: string) {
  const organisation = await db.organisation.findUnique({
    where: { id: organisationId },
    include: { memberships: { where: { role: "OWNER" }, orderBy: { createdAt: "asc" }, take: 1, include: { user: { select: { name: true, email: true, phone: true } } } } },
  });
  if (!organisation) throw new Error("Cannot provision a Paga account for an unknown organisation.");
  const owner = organisation.memberships[0]?.user;
  if (!owner) throw new Error("A business owner must exist before its Paga account can be provisioned.");
  return provision({ kind: "organisation", id: organisation.id }, { name: organisation.name, email: owner.email, phone: owner.phone });
}
