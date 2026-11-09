import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { UsersRound } from "lucide-react";

export default async function TalentPage() {
  await requireUser();
  const profiles = await db.professionalProfile.findMany({ where: { isPublished: true, verificationStatus: "VERIFIED" }, include: { user: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 60 });
  return <main className="app-main"><div className="page-title-row"><div><span className="welcome-label">Curated network</span><h1>Find a specialist</h1><p>Profiles become visible here only after review and explicit publication.</p></div></div>{profiles.length ? <div className="talent-grid">{profiles.map((profile) => <article className="talent-card" key={profile.id}><span className="talent-avatar">{profile.user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><h3>{profile.user.name}</h3><p>{profile.headline ?? "Independent professional"} · {profile.city ?? profile.country}</p><div className="talent-tags">{profile.skills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div><span className="status-pill green" style={{ marginTop: 14 }}>Verified</span></article>)}</div> : <section className="panel empty-state"><div><span className="empty-icon"><UsersRound size={18} /></span><h3>The curated directory is being prepared</h3><p>No specialist profiles are currently approved for discovery. We will show reviewed profiles here as the Nigeria-first network is curated.</p></div></section>}</main>;
}
