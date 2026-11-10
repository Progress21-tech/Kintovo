CREATE TYPE "SpecialistLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');

ALTER TABLE "ProfessionalProfile"
ADD COLUMN "expertiseLevel" "SpecialistLevel" NOT NULL DEFAULT 'LEVEL_1';

CREATE TABLE "RateCeiling" (
    "currency" TEXT NOT NULL,
    "level" "SpecialistLevel" NOT NULL,
    "amount" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RateCeiling_pkey" PRIMARY KEY ("currency", "level"),
    CONSTRAINT "RateCeiling_amount_check" CHECK ("amount" > 0)
);
