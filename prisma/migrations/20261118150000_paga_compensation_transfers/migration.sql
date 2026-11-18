CREATE TABLE "PagaCompensationTransfer" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "providerTransactionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagaCompensationTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PagaCompensationTransfer_obligationId_key" ON "PagaCompensationTransfer"("obligationId");
CREATE UNIQUE INDEX "PagaCompensationTransfer_referenceNumber_key" ON "PagaCompensationTransfer"("referenceNumber");
CREATE UNIQUE INDEX "PagaCompensationTransfer_providerTransactionId_key" ON "PagaCompensationTransfer"("providerTransactionId");
CREATE INDEX "PagaCompensationTransfer_completedAt_createdAt_idx" ON "PagaCompensationTransfer"("completedAt", "createdAt");
ALTER TABLE "PagaCompensationTransfer" ADD CONSTRAINT "PagaCompensationTransfer_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "CompensationObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagaCompensationTransfer" ADD CONSTRAINT "PagaCompensationTransfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "PagaAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagaCompensationTransfer" ADD CONSTRAINT "PagaCompensationTransfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "PagaAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
