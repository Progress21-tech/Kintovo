ALTER TABLE "PagaPayout" ADD COLUMN "payoutStartedAt" TIMESTAMP(3);
ALTER TABLE "PagaPayout" ADD COLUMN "chargeStartedAt" TIMESTAMP(3);
ALTER TABLE "WithdrawalRequest" ADD COLUMN "pagaBankDestinationId" TEXT;

CREATE INDEX "WithdrawalRequest_pagaBankDestinationId_idx" ON "WithdrawalRequest"("pagaBankDestinationId");
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_pagaBankDestinationId_fkey" FOREIGN KEY ("pagaBankDestinationId") REFERENCES "PagaBankDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
