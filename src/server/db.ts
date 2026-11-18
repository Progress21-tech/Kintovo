import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for Kintovo persistence.");
  // Optional pool cap: serverless platforms, PgBouncer, and single-connection local servers
  // (such as `prisma dev`) need a small pool. node-postgres ignores Prisma's connection_limit URL option.
  const max = Number(process.env.DATABASE_POOL_MAX);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ...(Number.isInteger(max) && max > 0 ? { max } : {}) }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
