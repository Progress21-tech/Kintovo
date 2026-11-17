ALTER TYPE "WithdrawalStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "WithdrawalStatus" ADD VALUE 'PAYOUT_FAILED';

CREATE TYPE "PagaAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED', 'DISABLED');
CREATE TYPE "PagaLedgerDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "PagaLedgerKind" AS ENUM ('PROVIDER_FUNDING', 'USD_COLLECTION_CREDIT', 'EARNINGS_CREDIT', 'WITHDRAWAL_DEBIT', 'REVERSAL', 'ADJUSTMENT');
CREATE TYPE "PagaUsdCollectionStatus" AS ENUM ('REQUESTED', 'CAPTURED', 'FUNDING_FAILED', 'TOP_UP_PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "PagaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organisationId" TEXT,
    "accountReference" TEXT NOT NULL,
    "provisioningReference" TEXT NOT NULL,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PagaAccountStatus" NOT NULL DEFAULT 'PENDING',
    "provisioningError" TEXT,
    "lastBalanceMinor" BIGINT,
    "lastBalanceSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagaAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PagaAccount_exactly_one_owner" CHECK (("userId" IS NOT NULL) <> ("organisationId" IS NOT NULL)),
    CONSTRAINT "PagaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PagaAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PagaAccount_userId_key" ON "PagaAccount"("userId");
CREATE UNIQUE INDEX "PagaAccount_organisationId_key" ON "PagaAccount"("organisationId");
CREATE UNIQUE INDEX "PagaAccount_accountReference_key" ON "PagaAccount"("accountReference");
CREATE UNIQUE INDEX "PagaAccount_provisioningReference_key" ON "PagaAccount"("provisioningReference");
CREATE UNIQUE INDEX "PagaAccount_accountNumber_key" ON "PagaAccount"("accountNumber");
CREATE INDEX "PagaAccount_status_createdAt_idx" ON "PagaAccount"("status", "createdAt");

CREATE TABLE "PagaUsdCollection" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "topUpReference" TEXT NOT NULL,
    "requestedNgnMinor" BIGINT NOT NULL,
    "status" "PagaUsdCollectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "paymentId" TEXT,
    "sourceAmountUsd" TEXT,
    "creditedAmountMinor" BIGINT,
    "reportedNgnMinor" BIGINT,
    "foreignExchangeRate" TEXT,
    "responseData" JSONB,
    "webhookData" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagaUsdCollection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PagaUsdCollection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PagaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PagaUsdCollection_referenceNumber_key" ON "PagaUsdCollection"("referenceNumber");
CREATE UNIQUE INDEX "PagaUsdCollection_topUpReference_key" ON "PagaUsdCollection"("topUpReference");
CREATE UNIQUE INDEX "PagaUsdCollection_paymentId_key" ON "PagaUsdCollection"("paymentId");
CREATE INDEX "PagaUsdCollection_accountId_createdAt_idx" ON "PagaUsdCollection"("accountId", "createdAt");
CREATE INDEX "PagaUsdCollection_status_createdAt_idx" ON "PagaUsdCollection"("status", "createdAt");

CREATE TABLE "PagaAccountLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "direction" "PagaLedgerDirection" NOT NULL,
    "kind" "PagaLedgerKind" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "providerTransactionId" TEXT,
    "providerEventId" TEXT,
    "sourceCurrency" TEXT,
    "sourceAmount" TEXT,
    "foreignExchangeRate" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PagaAccountLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PagaAccountLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PagaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PagaAccountLedgerEntry_accountId_reference_key" ON "PagaAccountLedgerEntry"("accountId", "reference");
CREATE UNIQUE INDEX "PagaAccountLedgerEntry_providerTransactionId_key" ON "PagaAccountLedgerEntry"("providerTransactionId");
CREATE UNIQUE INDEX "PagaAccountLedgerEntry_providerEventId_key" ON "PagaAccountLedgerEntry"("providerEventId");
CREATE INDEX "PagaAccountLedgerEntry_accountId_createdAt_idx" ON "PagaAccountLedgerEntry"("accountId", "createdAt");

CREATE TABLE "PagaBankDestination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankPublicId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumberCipher" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagaBankDestination_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PagaBankDestination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PagaBankDestination_userId_isDefault_idx" ON "PagaBankDestination"("userId", "isDefault");

CREATE TABLE "PagaPayout" (
    "id" TEXT NOT NULL,
    "withdrawalRequestId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "bankDestinationId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "amountMinor" BIGINT NOT NULL,
    "chargeReference" TEXT NOT NULL,
    "payoutReference" TEXT NOT NULL,
    "chargeTransactionId" TEXT,
    "payoutTransactionId" TEXT,
    "chargeCompletedAt" TIMESTAMP(3),
    "payoutCompletedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagaPayout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PagaPayout_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PagaPayout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PagaAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PagaPayout_bankDestinationId_fkey" FOREIGN KEY ("bankDestinationId") REFERENCES "PagaBankDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PagaPayout_withdrawalRequestId_key" ON "PagaPayout"("withdrawalRequestId");
CREATE UNIQUE INDEX "PagaPayout_chargeReference_key" ON "PagaPayout"("chargeReference");
CREATE UNIQUE INDEX "PagaPayout_payoutReference_key" ON "PagaPayout"("payoutReference");
CREATE INDEX "PagaPayout_createdAt_idx" ON "PagaPayout"("createdAt");
CREATE INDEX "PagaPayout_chargeCompletedAt_payoutCompletedAt_idx" ON "PagaPayout"("chargeCompletedAt", "payoutCompletedAt");
