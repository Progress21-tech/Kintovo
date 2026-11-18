ALTER TABLE "PagaPayout" ADD COLUMN "providerReversalId" TEXT;
ALTER TABLE "PagaPayout" ADD COLUMN "reimbursementReference" TEXT;
ALTER TABLE "PagaPayout" ADD COLUMN "reimbursementStartedAt" TIMESTAMP(3);
ALTER TABLE "PagaPayout" ADD COLUMN "reimbursedAt" TIMESTAMP(3);
ALTER TABLE "PagaPayout" ADD COLUMN "estimatedFeeMinor" BIGINT;
ALTER TABLE "PagaPayout" ADD COLUMN "estimatedVatMinor" BIGINT;
CREATE UNIQUE INDEX "PagaPayout_reimbursementReference_key" ON "PagaPayout"("reimbursementReference");