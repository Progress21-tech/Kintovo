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
  const context: "SPECIALIST" | "CREATOR" = requestedContext === "CREATOR" || (!specialist && !!creator) ? "CREATOR" : "SPECIALIST";
  const profile: ProfileValues = context === "SPECIALIST" ? {
    ...specialist,
    portfolio: specialist?.portfolio.map((item) => `${item.title} | ${item.url ?? ""} | ${item.contribution ?? ""}`).join("\n"),
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
  return <main className="app-main">
    <PageHeader eyebrow="Your account" title="Professional onboarding" description="Keep your business and professional identities in one account. You can maintain both a specialist profile and a creator profile." />
    <div className="context-tabs" aria-label="Choose profile type">
      <Link className={`context-tab${context === "SPECIALIST" ? " active" : ""}`} aria-current={context === "SPECIALIST" ? "page" : undefined} href="/workspace/profile?context=SPECIALIST">Specialist profile{specialist?.onboardingCompletedAt ? " · submitted" : ""}</Link>
      <Link className={`context-tab${context === "CREATOR" ? " active" : ""}`} aria-current={context === "CREATOR" ? "page" : undefined} href="/workspace/profile?context=CREATOR">Creator profile{creator?.onboardingCompletedAt ? " · submitted" : ""}</Link>
    </div>
    <div className="profile-status-row"><span className="status-pill">{submittedAt ? "Onboarding submitted" : "Private draft"}</span>{currentStatus && currentStatus !== "NOT_STARTED" && <span className={`status-pill ${currentStatus === "VERIFIED" ? "green" : currentStatus === "IN_REVIEW" ? "blue" : currentStatus === "REJECTED" ? "amber" : ""}`}>{currentStatus.replaceAll("_", " ")}</span>}<span className="field-note">Profiles are not visible in discovery until an authorised review and publication.</span></div>
    <ProfileForm profile={profile} context={context} />
  </main>;
}
