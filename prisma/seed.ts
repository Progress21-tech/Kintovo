import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/server/db";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_SEED !== "1") {
    throw new Error("Demo seed is disabled. Set ENABLE_DEMO_SEED=1 in a local development environment only.");
  }
  const email = "buyer@example.test";
  const passwordHash = await bcrypt.hash("Kintovo-demo-only!2026", 12);
  const user = await db.user.upsert({
    where: { email },
    create: { name: "Demo Buyer", email, passwordHash, emailVerifiedAt: new Date() },
    update: { name: "Demo Buyer", passwordHash, emailVerifiedAt: new Date(), disabledAt: null },
  });
  const organisation = await db.organisation.upsert({
    where: { id: "demo-company-fictional" },
    create: { id: "demo-company-fictional", name: "Demo Company (fictional)", industry: "Digital products", location: "Nigeria" },
    update: { name: "Demo Company (fictional)" },
  });
  await db.organisationMembership.upsert({
    where: { organisationId_userId: { organisationId: organisation.id, userId: user.id } },
    create: { organisationId: organisation.id, userId: user.id, role: "OWNER" },
    update: { role: "OWNER" },
  });
  await db.professionalProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, headline: "Fictional local research profile", country: "Nigeria", languages: ["English"], categories: ["Market research"], skills: ["Audience insight"], verificationStatus: "NOT_STARTED", isPublished: false },
    update: { isPublished: false, verificationStatus: "NOT_STARTED" },
  });
  console.info("Development-only demo account created: buyer@example.test / Kintovo-demo-only!2026");
  console.info("The organisation and profile are fictional. The profile is not verified and is not visible in talent discovery.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
