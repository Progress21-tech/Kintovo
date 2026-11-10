ALTER TABLE "User"
ADD COLUMN "bannedAt" TIMESTAMP(3),
ADD COLUMN "banReason" TEXT,
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

CREATE INDEX "User_lastActiveAt_disabledAt_bannedAt_idx"
ON "User"("lastActiveAt", "disabledAt", "bannedAt");
