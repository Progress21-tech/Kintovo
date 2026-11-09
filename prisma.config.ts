import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Prisma CLI operations (migrations/introspection) need a direct, unpooled URL.
  // Runtime Prisma Client uses the pooled DATABASE_URL in src/server/db.ts.
  datasource: { url: env("DIRECT_URL") },
});
