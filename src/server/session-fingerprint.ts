import { createHmac } from "node:crypto";

/**
 * Short keyed digest of the account's current password hash. It is stored in the
 * session token at sign-in and re-checked on every authenticated request, so
 * resetting a password immediately signs out every other session for the account.
 * The value cannot be reversed into the password hash.
 */
export function sessionFingerprint(passwordHash: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "kintovo-session")
    .update(passwordHash)
    .digest("hex")
    .slice(0, 32);
}
