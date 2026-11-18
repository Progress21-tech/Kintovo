-- Private files, notification preferences, partial settlements, dispute notes,
-- trust appeals, and campaign attribution rules.
-- CreateEnum
CREATE TYPE "FileAssetPurpose" AS ENUM ('PORTFOLIO', 'MILESTONE_SUBMISSION', 'PROJECT_MESSAGE', 'DISPUTE_EVIDENCE', 'TRUST_EVIDENCE', 'IDENTITY_EVIDENCE', 'CAMPAIGN_CONTENT');

-- CreateEnum
CREATE TYPE "SettlementProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'REJECTED');

-- AlterEnum
ALTER TYPE "CampaignAttributionStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "approvalRequirements" TEXT,
ADD COLUMN     "attributionExclusions" TEXT,
ADD COLUMN     "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "budget" INTEGER,
ADD COLUMN     "compensationModel" TEXT NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "conversionRule" TEXT,
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "postingSchedule" TEXT,
ADD COLUMN     "refundTreatment" TEXT NOT NULL DEFAULT 'EXCLUDE_REFUNDED',
ADD COLUMN     "reportingRequirements" TEXT,
ADD COLUMN     "targetAudience" TEXT,
ADD COLUMN     "targetGeography" TEXT;

-- AlterTable
ALTER TABLE "CampaignAttribution" ADD COLUMN     "eventType" TEXT NOT NULL DEFAULT 'ORDER',
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "agreementId" TEXT,
ADD COLUMN     "agreementVersion" INTEGER,
ADD COLUMN     "assignedReviewerId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "emailedAt" TIMESTAMP(3),
ADD COLUMN     "href" TEXT;

-- AlterTable
ALTER TABLE "RateCeiling" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","category")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "purpose" "FileAssetPurpose" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "projectId" TEXT,
    "submissionId" TEXT,
    "messageId" TEXT,
    "disputeId" TEXT,
    "portfolioItemId" TEXT,
    "trustReviewId" TEXT,
    "campaignContentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneSettlementProposal" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SettlementProposalStatus" NOT NULL DEFAULT 'PENDING',
    "respondedById" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneSettlementProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeNote" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PARTIES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustAppeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'APPEAL',
    "trustReviewId" TEXT,
    "assessmentId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "reviewerId" TEXT,
    "staffNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_projectId_createdAt_idx" ON "FileAsset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_ownerId_purpose_idx" ON "FileAsset"("ownerId", "purpose");

-- CreateIndex
CREATE INDEX "MilestoneSettlementProposal_milestoneId_status_idx" ON "MilestoneSettlementProposal"("milestoneId", "status");

-- CreateIndex
CREATE INDEX "DisputeNote_disputeId_createdAt_idx" ON "DisputeNote"("disputeId", "createdAt");

-- CreateIndex
CREATE INDEX "TrustAppeal_status_createdAt_idx" ON "TrustAppeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrustAppeal_userId_createdAt_idx" ON "TrustAppeal"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedReviewerId_fkey" FOREIGN KEY ("assignedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ProjectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_trustReviewId_fkey" FOREIGN KEY ("trustReviewId") REFERENCES "TrustReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_campaignContentId_fkey" FOREIGN KEY ("campaignContentId") REFERENCES "CampaignContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSettlementProposal" ADD CONSTRAINT "MilestoneSettlementProposal_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSettlementProposal" ADD CONSTRAINT "MilestoneSettlementProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneSettlementProposal" ADD CONSTRAINT "MilestoneSettlementProposal_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeNote" ADD CONSTRAINT "DisputeNote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeNote" ADD CONSTRAINT "DisputeNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAppeal" ADD CONSTRAINT "TrustAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAppeal" ADD CONSTRAINT "TrustAppeal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAppeal" ADD CONSTRAINT "TrustAppeal_trustReviewId_fkey" FOREIGN KEY ("trustReviewId") REFERENCES "TrustReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustAppeal" ADD CONSTRAINT "TrustAppeal_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SkillsAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
