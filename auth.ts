import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { rateLimitLogin } from "@/server/rate-limit";

const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === "true";

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
        const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse(credentials);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user || user.disabledAt || (requireEmailVerification && !user.emailVerifiedAt)) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, name: user.name, email: user.email, platformRole: user.platformRole };
      },
    }),
  ],
  callbacks: {
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
