import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { rateLimitLogin } from "@/server/rate-limit";

const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION !== "false";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const emailKey = String(credentials?.email ?? "").trim().toLowerCase().slice(0, 320) || "invalid";
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100);
        if (!await rateLimitLogin(emailKey, ip)) return null;
        const parsed = z.object({ email: z.email().trim(), password: z.string().min(1) }).safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || user.disabledAt || user.bannedAt || (requireEmailVerification && !user.emailVerifiedAt)) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole };
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
      if (!email || profile && "email_verified" in profile && profile.email_verified === false) return false;
      const existing = await db.user.findUnique({ where: { email } });
      if (existing?.disabledAt || existing?.bannedAt) return false;
      const persisted = existing ?? await db.user.create({
        data: {
          name: user.name?.trim() || email.split("@")[0],
          email,
          passwordHash: `oauth_google_${randomBytes(32).toString("hex")}`,
          emailVerifiedAt: new Date(),
        },
      });
      if (existing && !existing.emailVerifiedAt) {
        await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
      }
      user.id = persisted.id;
      user.name = persisted.name;
      user.email = persisted.email;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.platformRole = (user as typeof user & { platformRole?: string }).platformRole ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      if (session.user) session.user.platformRole = typeof token.platformRole === "string" ? token.platformRole : "USER";
      return session;
    },
  },
});
