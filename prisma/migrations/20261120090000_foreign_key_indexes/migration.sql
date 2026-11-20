-- Index foreign keys that pages filter and join on. PostgreSQL does not index foreign keys automatically.

CREATE INDEX IF NOT EXISTS "Workstream_projectId_idx" ON "Workstream"("projectId");
CREATE INDEX IF NOT EXISTS "PortfolioItem_profileId_idx" ON "PortfolioItem"("profileId");
CREATE INDEX IF NOT EXISTS "Submission_milestoneId_idx" ON "Submission"("milestoneId");
CREATE INDEX IF NOT EXISTS "TrustReview_professionalProfileId_idx" ON "TrustReview"("professionalProfileId");
CREATE INDEX IF NOT EXISTS "TrustReview_creatorProfileId_idx" ON "TrustReview"("creatorProfileId");
CREATE INDEX IF NOT EXISTS "Campaign_organisationId_idx" ON "Campaign"("organisationId");
CREATE INDEX IF NOT EXISTS "Campaign_createdById_idx" ON "Campaign"("createdById");
CREATE INDEX IF NOT EXISTS "CompensationObligation_recipientId_status_idx" ON "CompensationObligation"("recipientId", "status");
CREATE INDEX IF NOT EXISTS "CompensationObligation_projectId_idx" ON "CompensationObligation"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTask_assigneeProfileId_idx" ON "ProjectTask"("assigneeProfileId");
CREATE INDEX IF NOT EXISTS "ProjectMessage_taskId_idx" ON "ProjectMessage"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectMessage_parentId_idx" ON "ProjectMessage"("parentId");
CREATE INDEX IF NOT EXISTS "FileAsset_submissionId_idx" ON "FileAsset"("submissionId");
CREATE INDEX IF NOT EXISTS "FileAsset_messageId_idx" ON "FileAsset"("messageId");
CREATE INDEX IF NOT EXISTS "FileAsset_disputeId_idx" ON "FileAsset"("disputeId");
CREATE INDEX IF NOT EXISTS "FileAsset_portfolioItemId_idx" ON "FileAsset"("portfolioItemId");
CREATE INDEX IF NOT EXISTS "FileAsset_trustReviewId_idx" ON "FileAsset"("trustReviewId");
CREATE INDEX IF NOT EXISTS "FileAsset_campaignContentId_idx" ON "FileAsset"("campaignContentId");
