import { auth } from "@/auth";
import { db } from "@/server/db";
import { canAccessFile } from "@/server/file-access";
import { getProjectAccess } from "@/server/project-access";
import { privateStorage } from "@/server/storage";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Controlled download for private uploads. Every request re-checks the viewer's access. */
export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Sign in required", { status: 401, headers: { "Cache-Control": "no-store" } });
  const viewer = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, platformRole: true, disabledAt: true, bannedAt: true } });
  if (!viewer || viewer.disabledAt || viewer.bannedAt) return new Response("Forbidden", { status: 403 });
  const { fileId } = await params;
  const file = await db.fileAsset.findUnique({
    where: { id: fileId },
    include: {
      portfolioItem: { select: { isPublic: true, profile: { select: { isPublished: true } } } },
      campaignContent: { select: { campaignCreator: { select: { creator: { select: { userId: true } }, campaign: { select: { organisationId: true, createdById: true } } } } } },
    },
  });
  // Report missing and forbidden files identically so ids cannot be probed.
  if (!file || file.deletedAt) return notFound();

  let projectParticipant = false;
  if (file.projectId) projectParticipant = (await getProjectAccess(file.projectId, viewer.id)).canView;

  let campaignParticipant = false;
  const campaign = file.campaignContent?.campaignCreator;
  if (campaign) {
    campaignParticipant = campaign.creator.userId === viewer.id || campaign.campaign.createdById === viewer.id;
    if (!campaignParticipant && campaign.campaign.organisationId) {
      const membership = await db.organisationMembership.findUnique({ where: { organisationId_userId: { organisationId: campaign.campaign.organisationId, userId: viewer.id } }, select: { id: true } });
      campaignParticipant = Boolean(membership);
    }
  }

  const allowed = canAccessFile({
    viewerId: viewer.id, platformRole: viewer.platformRole, ownerId: file.ownerId, purpose: file.purpose,
    projectParticipant, campaignParticipant,
    publicPortfolio: Boolean(file.portfolioItem?.isPublic && file.portfolioItem.profile.isPublished),
  });
  if (!allowed) return notFound();

  if (file.purpose === "IDENTITY_EVIDENCE" && viewer.id !== file.ownerId) {
    await db.auditLog.create({ data: { actorId: viewer.id, action: "IDENTITY_EVIDENCE_ACCESSED", entityType: "FileAsset", entityId: file.id } });
  }
  let bytes: Buffer;
  try { bytes = await privateStorage().get(file.storageKey); } catch { return notFound(); }
  const inline = file.contentType.startsWith("image/") || file.contentType === "application/pdf";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
