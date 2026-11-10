CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAID');

CREATE TABLE "EngagementRating" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngagementRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EngagementRating_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "EngagementRating_engagementId_revieweeId_key" ON "EngagementRating"("engagementId", "revieweeId");
CREATE INDEX "EngagementRating_revieweeId_createdAt_idx" ON "EngagementRating"("revieweeId", "createdAt");
CREATE INDEX "EngagementRating_projectId_createdAt_idx" ON "EngagementRating"("projectId", "createdAt");

ALTER TABLE "EngagementRating" ADD CONSTRAINT "EngagementRating_engagementId_fkey"
FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementRating" ADD CONSTRAINT "EngagementRating_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementRating" ADD CONSTRAINT "EngagementRating_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EngagementRating" ADD CONSTRAINT "EngagementRating_revieweeId_fkey"
FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignRating" (
    "id" TEXT NOT NULL,
    "campaignCreatorId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CampaignRating_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "CampaignRating_campaignCreatorId_revieweeId_key" ON "CampaignRating"("campaignCreatorId", "revieweeId");
CREATE INDEX "CampaignRating_revieweeId_createdAt_idx" ON "CampaignRating"("revieweeId", "createdAt");
ALTER TABLE "CampaignRating" ADD CONSTRAINT "CampaignRating_campaignCreatorId_fkey"
FOREIGN KEY ("campaignCreatorId") REFERENCES "CampaignCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRating" ADD CONSTRAINT "CampaignRating_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRating" ADD CONSTRAINT "CampaignRating_revieweeId_fkey"
FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewAfter" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WithdrawalRequest_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "WithdrawalRequest_status_reviewAfter_idx" ON "WithdrawalRequest"("status", "reviewAfter");
CREATE INDEX "WithdrawalRequest_userId_status_requestedAt_idx" ON "WithdrawalRequest"("userId", "status", "requestedAt");

ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
