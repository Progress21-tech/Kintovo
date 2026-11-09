import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { ProfileForm, type ProfileValues } from "./ProfileForm";

export default async function ProfilePage() {
  const user = await requireUser();
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const profile: ProfileValues = specialist ? specialist : creator ? { biography: creator.biography, platforms: creator.platforms, creatorCategories: creator.contentCategories } : {};
  return <main className="app-main"><div className="page-title-row"><div><span className="welcome-label">Your account</span><h1>Profile details</h1><p>Save professional or creator context to complete your onboarding.</p></div><span className="status-pill">Private draft</span></div><ProfileForm profile={profile} defaultContext={specialist ? "SPECIALIST" : creator ? "CREATOR" : "SPECIALIST"} /></main>;
}
