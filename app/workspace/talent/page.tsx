import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { explainMatch } from "@/server/matching";
import { ShortlistForm } from "./ShortlistForm";

type Query = { q?: string; category?: string; skill?: string; market?: string; availability?: string; projectId?: string };

export default async function TalentPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireUser();
  const query = await searchParams;
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, select: { organisationId: true, role: true } });
  if (!memberships.some((membership) => ["OWNER", "ADMIN", "PROJECT_MANAGER"].includes(membership.role))) redirect("/workspace");
  const organisationIds = memberships.map((membership) => membership.organisationId);
  const projects = await db.project.findMany({ where: { organisationId: { in: organisationIds }, status: { notIn: ["CANCELLED", "COMPLETED"] } }, include: { brief: true, workstreams: true }, orderBy: { updatedAt: "desc" }, take: 100 });
  const selectedProject = projects.find((project) => project.id === query.projectId);
  const profiles = await db.professionalProfile.findMany({
    where: { isPublished: true, trustReviews: { some: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" } } },
    include: { user: { select: { name: true } }, portfolio: { where: { isPublic: true }, take: 4 }, trustReviews: { where: { status: "APPROVED" }, select: { dimension: true } } },
    orderBy: { user: { name: "asc" } },
    take: 200,
  });
  const profileUserIds = profiles.map((profile) => profile.userId);
  const [reviewStats, campaignReviewStats] = await Promise.all([
    profileUserIds.length ? db.engagementRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: profileUserIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
    profileUserIds.length ? db.campaignRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: profileUserIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const reputation = new Map<string, { sum: number; count: number }>();
  for (const item of [...reviewStats, ...campaignReviewStats]) {
    const current = reputation.get(item.revieweeId) ?? { sum: 0, count: 0 };
    current.sum += (item._avg.rating ?? 0) * item._count._all;
    current.count += item._count._all;
    reputation.set(item.revieweeId, current);
  }
  const needle = query.q?.trim().toLowerCase();
  const filtered = profiles.filter((profile) => {
    if (needle && ![profile.user.name, profile.headline ?? "", profile.biography ?? "", ...profile.skills, ...profile.categories, profile.marketExperience ?? ""].some((item) => item.toLowerCase().includes(needle))) return false;
    if (query.category && !profile.categories.some((item) => item.toLowerCase().includes(query.category!.toLowerCase()))) return false;
    if (query.skill && !profile.skills.some((item) => item.toLowerCase().includes(query.skill!.toLowerCase()))) return false;
    if (query.market && !(profile.marketExperience ?? "").toLowerCase().includes(query.market.toLowerCase())) return false;
    if (query.availability && profile.availabilityStatus !== query.availability) return false;
    return true;
  });
  const context = selectedProject ? {
    capabilities: [...new Set(selectedProject.workstreams.flatMap((stream) => stream.capabilities))],
    roles: [...new Set(selectedProject.workstreams.flatMap((stream) => stream.recommendedRoles))],
    targetMarket: selectedProject.brief?.targetMarket ?? "Nigeria",
    budgetMin: selectedProject.brief?.budgetMin,
    budgetMax: selectedProject.brief?.budgetMax,
  } : null;
  const ranked = filtered.map((profile) => ({ profile, match: context ? explainMatch(profile, context) : null })).sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0) || a.profile.user.name.localeCompare(b.profile.user.name));

  return <main className="app-main">
    <PageHeader eyebrow="Curated talent network" title="Find a specialist" description="Search published profiles reviewed for discovery. Project fit signals explain possible relevance; they do not make a hiring decision." />
    <form className="panel talent-search-form" method="get">
      <label>Project match<select name="projectId" defaultValue={selectedProject?.id ?? ""}><option value="">Browse without a project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
      <label>Search<input name="q" defaultValue={query.q} placeholder="Name, role, skill, or experience" /></label>
      <label>Category<input name="category" defaultValue={query.category} placeholder="e.g. Market research" /></label>
      <label>Skill<input name="skill" defaultValue={query.skill} placeholder="e.g. Figma" /></label>
      <label>Market expertise<input name="market" defaultValue={query.market} placeholder="e.g. Nigeria" /></label>
      <label>Availability<select name="availability" defaultValue={query.availability ?? ""}><option value="">Any status</option><option value="AVAILABLE">Available</option><option value="AVAILABLE_FROM">Available from a future date</option><option value="UNAVAILABLE">Unavailable</option></select></label>
      <button className="button button-primary">Search profiles</button>
    </form>
    {selectedProject && <p className="match-note">Project fit is based on listed role/skill overlap, market experience, availability, and indicative rate where supplied. A missing signal means the profile did not provide that information; it is not a negative quality judgement.</p>}
    {ranked.length ? <div className="talent-grid">{ranked.map(({ profile, match }) => <article className="talent-card" key={profile.id}>
      <span className="talent-avatar" aria-hidden="true">{profile.user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
      <h3>{profile.user.name}</h3><p>{profile.headline ?? "Independent professional"} · {[profile.city, profile.country].filter(Boolean).join(", ")}</p>
      <div className="talent-tags">{profile.categories.slice(0, 4).map((item) => <span className="chip" key={item}>{item}</span>)}{profile.skills.slice(0, 5).map((item) => <span className="chip" key={item}>{item}</span>)}</div>
      <div className="talent-meta"><span className="status-pill green">Profile reviewed</span>{reputation.has(profile.userId) && <span className="status-pill blue">{(reputation.get(profile.userId)!.sum / reputation.get(profile.userId)!.count).toFixed(1)}/5 · {reputation.get(profile.userId)!.count} ratings</span>}{match && <span className="status-pill blue">{match.reasons.length} fit signals</span>}<span className="field-note">{profile.availabilityStatus.replaceAll("_", " ")}{profile.availability ? ` · ${profile.availability}` : ""}</span></div>
      {profile.marketExperience && <p className="talent-market">Market experience: {profile.marketExperience}</p>}
      {profile.trustReviews.length > 0 && <div className="talent-tags">{profile.trustReviews.map((review) => <span className="chip" key={review.dimension}>{review.dimension.replaceAll("_", " ")} reviewed</span>)}</div>}
      {match && <div className="match-explanation"><strong>Why this may fit</strong>{match.reasons.length ? <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>No positive fit signals were identified yet.</p>}{match.gaps.length > 0 && <details><summary>Information not confirmed</summary><ul>{match.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}</div>}
      {profile.portfolio.length > 0 && <div className="portfolio-links"><strong>Public work samples</strong>{profile.portfolio.map((item) => <a key={item.id} href={item.url ?? undefined} target="_blank" rel="noreferrer">{item.title}</a>)}</div>}
      <ShortlistForm profileId={profile.id} projects={projects.map((project) => ({ id: project.id, title: project.title }))} />
    </article>)}</div> : <section className="panel empty-state"><div><h3>{profiles.length ? "No profiles match those filters" : "The curated directory is being prepared"}</h3><p>{profiles.length ? "Adjust the search criteria or remove a filter." : "No specialist profiles are currently approved and published for discovery. Profiles will appear here after a human review."}</p></div></section>}
  </main>;
}
