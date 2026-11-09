import { createHash } from "node:crypto";
import { db } from "@/server/db";

export function rateLimitKey(...parts: string[]) {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

/** Atomic PostgreSQL fixed-window limiter. Store only a digest, not an email or IP address. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) return false;
  const rows = await db.$queryRaw<Array<{ allowed: boolean }>>`
    WITH bucket AS (
      INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
      VALUES (${key}, 1, NOW(), NOW() + (${windowSeconds} * INTERVAL '1 second'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN NOW() ELSE "RateLimitBucket"."windowStart" END,
        "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= NOW() THEN NOW() + (${windowSeconds} * INTERVAL '1 second') ELSE "RateLimitBucket"."expiresAt" END
      RETURNING "count"
    )
    SELECT "count" <= ${limit} AS allowed FROM bucket
  `;
  if (Number.parseInt(key.slice(0, 2), 16) % 128 === 0) {
    await db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
  return rows[0]?.allowed === true;
}

export async function rateLimitLogin(email: string, ip: string) {
  const results = await Promise.all([
    consumeRateLimit(rateLimitKey("login-email", email.toLowerCase()), 8, 15 * 60),
    consumeRateLimit(rateLimitKey("login-ip", ip), 40, 15 * 60),
  ]);
  return results.every(Boolean);
}
