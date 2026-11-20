import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { rateLimitLogin } from "@/server/rate-limit";
import { sessionFingerprint } from "@/server/session-fingerprint";

const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const emailKey = String(credentials?.email ?? "").trim().toLowerCase().slice(0, 320) || "invalid";
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100);
        if (!await rateLimitLogin(emailKey, ip)) {
          console.warn("[Kintovo auth] credentials denied: rate limited", { email: maskEmail(emailKey) });
          return null;
        }
        const parsed = z.object({ email: z.email().trim(), password: z.string().min(1) }).safeParse(credentials);
        if (!parsed.success) {
          console.warn("[Kintovo auth] credentials denied: invalid input", { email: maskEmail(emailKey), issues: parsed.error.issues.map((issue) => issue.message) });
          return null;
        }
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user) {
          console.warn("[Kintovo auth] credentials denied: user not found", { email: maskEmail(emailKey), requireEmailVerification });
          return null;
        }
        if (user.disabledAt || user.bannedAt) {
          console.warn("[Kintovo auth] credentials denied: account unavailable", {
            email: maskEmail(emailKey),
            disabled: Boolean(user.disabledAt),
            banned: Boolean(user.bannedAt),
          });
          return null;
        }
        if (requireEmailVerification && !user.emailVerifiedAt) {
          console.warn("[Kintovo auth] credentials denied: email not verified", { email: maskEmail(emailKey) });
          return null;
        }
        // Google-only accounts have no bcrypt hash; treat a malformed hash as a mismatch rather than a server error.
        if (!user.passwordHash.startsWith("$2") || !(await bcrypt.compare(parsed.data.password, user.passwordHash).catch(() => false))) {
          console.warn("[Kintovo auth] credentials denied: password mismatch", { email: maskEmail(emailKey) });
          return null;
        }
        console.info("[Kintovo auth] credentials sign-in accepted", { email: maskEmail(emailKey) });
        return { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole, sessionFingerprint: sessionFingerprint(user.passwordHash) };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) {
        console.warn("[Kintovo auth] Google sign-in denied: email missing");
        return "/sign-in?notice=google-email-missing";
      }
      const googleVerified = Boolean(profile && "email_verified" in profile && profile.email_verified === true);
      if (requireEmailVerification && !googleVerified) {
        console.warn("[Kintovo auth] Google sign-in denied: email not verified", { email: maskEmail(email) });
        return "/sign-in?notice=google-email-unverified";
      }
      const existing = await db.user.findUnique({ where: { email } });
      // Linking a Google identity to an existing password account is only safe when
      // Google confirms the address belongs to this person; otherwise it is an account takeover.
      if (existing && !googleVerified) {
        console.warn("[Kintovo auth] Google sign-in denied: unverified email matches an existing account", { email: maskEmail(email) });
        return "/sign-in?notice=google-email-unverified";
      }
      if (existing?.disabledAt || existing?.bannedAt) {
        console.warn("[Kintovo auth] Google sign-in denied: account unavailable", {
          email: maskEmail(email),
          disabled: Boolean(existing.disabledAt),
          banned: Boolean(existing.bannedAt),
        });
        return "/sign-in?notice=account-unavailable";
      }
      const persisted = existing ?? await db.user.create({
        data: {
          name: user.name?.trim() || email.split("@")[0],
          email,
          passwordHash: `oauth_google_${randomBytes(32).toString("hex")}`,
          emailVerifiedAt: googleVerified ? new Date() : null,
        },
      });
      if (existing && !existing.emailVerifiedAt) {
        await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
      }
      user.id = persisted.id;
      user.name = persisted.name;
      user.email = persisted.email;
      user.platformRole = persisted.platformRole;
      user.sessionFingerprint = sessionFingerprint(persisted.passwordHash);
      console.info("[Kintovo auth] Google sign-in accepted", { email: maskEmail(email), existing: Boolean(existing) });
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.platformRole = user.platformRole ?? "USER";
        token.sessionFingerprint = user.sessionFingerprint;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      if (session.user) {
        session.user.platformRole = typeof token.platformRole === "string" ? token.platformRole : "USER";
        session.user.sessionFingerprint = typeof token.sessionFingerprint === "string" ? token.sessionFingerprint : undefined;
      }
      return session;
    },
  },
});
