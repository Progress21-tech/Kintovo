import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length > 200) return NextResponse.redirect(new URL("/sign-in?notice=invalid-link", request.url));
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await db.verificationToken.findFirst({ where: { token: tokenHash, purpose: "email_verification", expires: { gt: new Date() } } });
  if (!record) return NextResponse.redirect(new URL("/sign-in?notice=expired-link", request.url));
  const user = await db.user.findUnique({ where: { email: record.identifier }, select: { id: true } });
  if (!user) return NextResponse.redirect(new URL("/sign-in?notice=expired-link", request.url));
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
    db.verificationToken.delete({ where: { token: tokenHash } }),
    db.auditLog.create({ data: { actorId: user.id, action: "EMAIL_VERIFIED", entityType: "User", entityId: user.id } }),
  ]);
  return NextResponse.redirect(new URL("/sign-in?notice=email-verified", request.url));
}
