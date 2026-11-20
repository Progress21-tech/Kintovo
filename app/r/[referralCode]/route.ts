import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { consumeRateLimit, rateLimitKey } from "@/server/rate-limit";
import { safeExternalHref } from "@/lib/safe-href";

export async function GET(request: Request, { params }: { params: Promise<{ referralCode: string }> }) {
  const { referralCode } = await params;
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(referralCode)) return NextResponse.redirect(new URL("/for-creators", process.env.AUTH_URL ?? "http://localhost:3000"));
  const entry = await db.campaignCreator.findUnique({ where: { referralCode }, include: { campaign: { select: { landingUrl: true, status: true } } } });
  if (!entry || !["ACCEPTED", "ACTIVE"].includes(entry.status) || entry.campaign.status !== "ACTIVE") return NextResponse.redirect(new URL("/for-creators", process.env.AUTH_URL ?? "http://localhost:3000"));
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 100);
  if (await consumeRateLimit(rateLimitKey("campaign-click", referralCode, ip), 60, 10 * 60)) {
    await db.campaignClick.create({ data: { campaignCreatorId: entry.id, sourceEventId: randomUUID() } });
  }
  // Only ever redirect to an http(s) landing page; anything else falls back to Kintovo.
  const destination = safeExternalHref(entry.campaign.landingUrl) ?? "/for-creators";
  return NextResponse.redirect(new URL(destination, process.env.AUTH_URL ?? "http://localhost:3000"));
}
