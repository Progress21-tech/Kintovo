import type { FileAssetPurpose, PlatformRole } from "@/generated/prisma/client";

/** Facts about the viewer's relationship to a file, gathered server-side before calling the policy. */
export type FileAccessFacts = {
  viewerId: string;
  platformRole: PlatformRole;
  ownerId: string;
  purpose: FileAssetPurpose;
  /** Viewer can see the project workspace the file belongs to (org member or active engagement). */
  projectParticipant?: boolean;
  /** Portfolio file attached to a public item on a published profile. */
  publicPortfolio?: boolean;
  /** Viewer manages the campaign's organisation or is the creator on that campaign. */
  campaignParticipant?: boolean;
};

const staff = (role: PlatformRole) => role === "ADMIN" || role === "OPERATIONS";

/**
 * Central download policy. Identity evidence is restricted to the owner and platform
 * Admins only; ordinary Operations staff and other customers never receive it.
 */
export function canAccessFile(facts: FileAccessFacts): boolean {
  if (facts.viewerId === facts.ownerId) return true;
  switch (facts.purpose) {
    case "IDENTITY_EVIDENCE": return facts.platformRole === "ADMIN";
    case "TRUST_EVIDENCE": return staff(facts.platformRole);
    case "PORTFOLIO": return staff(facts.platformRole) || Boolean(facts.publicPortfolio);
    case "MILESTONE_SUBMISSION":
    case "PROJECT_MESSAGE":
    case "DISPUTE_EVIDENCE": return staff(facts.platformRole) || Boolean(facts.projectParticipant);
    case "CAMPAIGN_CONTENT": return staff(facts.platformRole) || Boolean(facts.campaignParticipant);
    default: return false;
  }
}
