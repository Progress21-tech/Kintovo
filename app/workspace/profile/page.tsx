import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { ProfileForm, type ProfileValues } from "./ProfileForm";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ context?: string }> }) {
  const user = await requireUser();
  const { context: requestedContext } = await searchParams;
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, include: { portfolio: { orderBy: { createdAt: "asc" } } } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const context: "SPECIALIST" | "CREATOR" = specialist ? "SPECIALIST" : creator ? "CREATOR" : requestedContext === "CREATOR" ? "CREATOR" : "SPECIALIST";
  const profile: ProfileValues = context === "SPECIALIST" ? {
    ...specialist,
    portfolio: specialist?.portfolio.map((item) => `${item.title} | ${item.url ?? ""} | ${item.contribution ?? ""} | ${item.isPublic ? "public" : "private"}`).join("\n"),
  } : {
    biography: creator?.biography,
    platforms: creator?.platforms,
    creatorCategories: creator?.contentCategories,
    audienceEvidence: creator?.audienceEvidence,
    audienceSize: creator?.audienceSize,
    audienceGeography: creator?.audienceGeography,
  };
  const currentStatus = context === "SPECIALIST" ? specialist?.verificationStatus : creator?.verificationStatus;
  const submittedAt = context === "SPECIALIST" ? specialist?.onboardingCompletedAt : creator?.onboardingCompletedAt;
  const profileTitle = context === "CREATOR" ? "Creator profile" : "Specialist profile";
  const profileDescription = context === "CREATOR"
    ? "Prepare your creator profile for campaign invitations, content work, and human review."
    : "Prepare your specialist profile for opportunities, project matching, and human review.";
  return <main className="app-main">
    <PageHeader eyebrow="Your account" title={profileTitle} description={profileDescription} />
    {!specialist && !creator ? <div className="context-tabs" aria-label="Choose profile type">
      <Link className={`context-tab${context === "SPECIALIST" ? " active" : ""}`} aria-current={context === "SPECIALIST" ? "page" : undefined} href="/workspace/profile?context=SPECIALIST">Specialist profile</Link>
      <Link className={`context-tab${context === "CREATOR" ? " active" : ""}`} aria-current={context === "CREATOR" ? "page" : undefined} href="/workspace/profile?context=CREATOR">Creator profile</Link>
    </div> : <p className="profile-context-lock">This account is set up as a {context === "SPECIALIST" ? "specialist" : "creator"} account. Your profile workspace is limited to that role.</p>}
    <div className="profile-status-row"><span className="status-pill">{submittedAt ? "Onboarding submitted" : "Private draft"}</span>{currentStatus && currentStatus !== "NOT_STARTED" && <span className={`status-pill ${currentStatus === "VERIFIED" ? "green" : currentStatus === "IN_REVIEW" ? "blue" : currentStatus === "REJECTED" ? "amber" : ""}`}>{currentStatus.replaceAll("_", " ")}</span>}<span className="field-note">Profiles are not visible in discovery until an authorised review and publication.</span></div>
    <ProfileForm profile={profile} context={context} />
  </main>;
}
