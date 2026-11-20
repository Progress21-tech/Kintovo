import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { explainMatch } from "@/server/matching";
import { ShortlistForm } from "./ShortlistForm";
import { safeExternalHref } from "@/lib/safe-href";

type Query = { q?: string; category?: string; skill?: string; market?: string; availability?: string; projectId?: string; language?: string; industry?: string; maxRate?: string; minLevel?: string; engagement?: string; minYears?: string; assessed?: string; sort?: string; compare?: string };
const levelOrder = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "LEVEL_4"];

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
    include: { user: { select: { name: true } }, portfolio: { where: { isPublic: true }, take: 4, include: { files: { where: { deletedAt: null }, select: { id: true }, take: 1 } } }, trustReviews: { where: { status: "APPROVED" }, select: { dimension: true } }, assessments: { where: { status: "APPROVED" }, select: { title: true } }, engagements: { where: { status: "COMPLETED" }, select: { id: true } } },
    orderBy: { user: { name: "asc" } },
    take: 200,
  });
  const profileUserIds = profiles.map((profile) => profile.userId);
  const [reviewStats, campaignReviewStats] = await Promise.all([
    profileUserIds.length ? db.engagementRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: profileUserIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
    profileUserIds.length ? db.campaignRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: profileUserIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const rateCeilings = profileUserIds.length ? await db.rateCeiling.findMany({ where: { currency: "NGN", level: { in: [...new Set(profiles.map((profile) => profile.expertiseLevel))] } } }) : [];
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
    if (query.language && !profile.languages.some((item) => item.toLowerCase().includes(query.language!.toLowerCase()))) return false;
    if (query.industry && !`${profile.marketExperience ?? ""} ${profile.biography ?? ""} ${profile.portfolio.map((item) => `${item.category ?? ""} ${item.description ?? ""}`).join(" ")}`.toLowerCase().includes(query.industry.toLowerCase())) return false;
    if (query.maxRate && Number(query.maxRate) > 0 && (profile.indicativeRate === null || profile.indicativeRate > Number(query.maxRate))) return false;
    if (query.minLevel && levelOrder.indexOf(profile.expertiseLevel) < levelOrder.indexOf(query.minLevel)) return false;
    if (query.engagement && !profile.preferredEngagements.some((item) => item.toLowerCase().includes(query.engagement!.toLowerCase()))) return false;
    if (query.minYears && (profile.yearsExperience ?? 0) < Number(query.minYears)) return false;
    if (query.assessed === "1" && profile.assessments.length === 0) return false;
    return true;
  });
  const context = selectedProject ? {
    capabilities: [...new Set(selectedProject.workstreams.flatMap((stream) => stream.capabilities))],
    roles: [...new Set(selectedProject.workstreams.flatMap((stream) => stream.recommendedRoles))],
    targetMarket: selectedProject.brief?.targetMarket ?? "Nigeria",
    budgetMin: selectedProject.brief?.budgetMin,
    budgetMax: selectedProject.brief?.budgetMax,
  } : null;
  const ranked = filtered.map((profile) => ({ profile, match: context ? explainMatch(profile, context) : null })).sort((a, b) => {
    const byName = a.profile.user.name.localeCompare(b.profile.user.name);
    switch (query.sort) {
      case "name": return byName;
      case "rate_asc": return (a.profile.indicativeRate ?? Number.MAX_SAFE_INTEGER) - (b.profile.indicativeRate ?? Number.MAX_SAFE_INTEGER) || byName;
      case "rate_desc": return (b.profile.indicativeRate ?? -1) - (a.profile.indicativeRate ?? -1) || byName;
      case "experience": return (b.profile.yearsExperience ?? -1) - (a.profile.yearsExperience ?? -1) || byName;
      case "level": return levelOrder.indexOf(b.profile.expertiseLevel) - levelOrder.indexOf(a.profile.expertiseLevel) || byName;
      default: return (b.match?.score ?? 0) - (a.match?.score ?? 0) || byName;
    }
  });
  const compareIds = (query.compare ?? "").split(",").filter(Boolean).slice(0, 4);
  const compared = compareIds.map((id) => ranked.find((item) => item.profile.id === id) ?? (() => { const profile = profiles.find((item) => item.id === id); return profile ? { profile, match: context ? explainMatch(profile, context) : null } : null; })()).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const withCompare = (ids: string[]) => { const p = new URLSearchParams(Object.entries(query).filter(([key, value]) => key !== "compare" && value) as [string, string][]); if (ids.length) p.set("compare", ids.join(",")); return `?${p.toString()}`; };

  return <main className="app-main">
    <PageHeader eyebrow="Curated talent network" title="Find a specialist" description="Search published profiles reviewed for discovery. Project fit signals explain possible relevance; they do not make a hiring decision." />
    <form className="panel talent-search-form" method="get">
      <label>Project match<select name="projectId" defaultValue={selectedProject?.id ?? ""}><option value="">Browse without a project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
      <label>Search<input name="q" defaultValue={query.q} placeholder="Name, role, skill, or experience" /></label>
      <label>Category<input name="category" defaultValue={query.category} placeholder="e.g. Market research" /></label>
      <label>Skill<input name="skill" defaultValue={query.skill} placeholder="e.g. Figma" /></label>
      <label>Market expertise<input name="market" defaultValue={query.market} placeholder="e.g. Nigeria" /></label>
      <label>Availability<select name="availability" defaultValue={query.availability ?? ""}><option value="">Any status</option><option value="AVAILABLE">Available</option><option value="AVAILABLE_FROM">Available from a future date</option><option value="UNAVAILABLE">Unavailable</option></select></label>
      <label>Language<input name="language" defaultValue={query.language} placeholder="e.g. Yoruba" /></label>
      <label>Industry experience<input name="industry" defaultValue={query.industry} placeholder="e.g. Fintech" /></label>
      <label>Max indicative rate (NGN)<input type="number" min="0" name="maxRate" defaultValue={query.maxRate} /></label>
      <label>Minimum level<select name="minLevel" defaultValue={query.minLevel ?? ""}><option value="">Any level</option>{levelOrder.map((level) => <option key={level} value={level}>{level.replace("_", " ")}</option>)}</select></label>
      <label>Engagement preference<input name="engagement" defaultValue={query.engagement} placeholder="Team project" /></label>
      <label>Minimum years of experience<input type="number" min="0" max="80" name="minYears" defaultValue={query.minYears} /></label>
      <label className="checkbox-row"><input type="checkbox" name="assessed" value="1" defaultChecked={query.assessed === "1"} /> Has an approved practical assessment</label>
      <label>Sort by<select name="sort" defaultValue={query.sort ?? ""}><option value="">{selectedProject ? "Project fit" : "Name"}</option><option value="name">Name</option><option value="rate_asc">Rate: low to high</option><option value="rate_desc">Rate: high to low</option><option value="experience">Years of experience</option><option value="level">Specialist level</option></select></label>
      {query.compare && <input type="hidden" name="compare" value={query.compare} />}
      <button className="button button-primary">Search profiles</button>
    </form>
    {selectedProject && <p className="match-note">Project fit is based on listed role/skill overlap, market experience, availability, and indicative rate where supplied. A missing signal means the profile did not provide that information; it is not a negative quality judgement.</p>}
    {compared.length > 0 && <section className="panel" aria-labelledby="compare-title" style={{ marginBottom: 16 }}><div className="panel-header"><h2 id="compare-title">Side-by-side comparison</h2><Link className="text-link" href={withCompare([])}>Clear comparison</Link></div><div className="panel-content"><div className="table-scroll"><table className="data-table">
      <thead><tr><th scope="col">Signal</th>{compared.map(({ profile }) => <th scope="col" key={profile.id}>{profile.user.name} <Link className="text-link" href={withCompare(compareIds.filter((id) => id !== profile.id))} aria-label={`Remove ${profile.user.name} from comparison`}>×</Link></th>)}</tr></thead>
      <tbody>
        <tr><th scope="row">Headline</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.headline ?? "—"}</td>)}</tr>
        <tr><th scope="row">Categories</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.categories.join(", ") || "—"}</td>)}</tr>
        <tr><th scope="row">Skills</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.skills.join(", ") || "—"}</td>)}</tr>
        <tr><th scope="row">Languages</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.languages.join(", ") || "—"}</td>)}</tr>
        <tr><th scope="row">Market experience</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.marketExperience ?? "Not stated"}</td>)}</tr>
        <tr><th scope="row">Experience</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.yearsExperience != null ? `${profile.yearsExperience} years` : "Not stated"}</td>)}</tr>
        <tr><th scope="row">Availability</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.availabilityStatus.replaceAll("_", " ").toLowerCase()}</td>)}</tr>
        <tr><th scope="row">Indicative rate</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.indicativeRate != null ? `${profile.currency} ${profile.indicativeRate.toLocaleString("en-NG")}` : "Not stated"}</td>)}</tr>
        <tr><th scope="row">Level / assessments</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.expertiseLevel.replace("_", " ")} · {profile.assessments.length} approved</td>)}</tr>
        <tr><th scope="row">Reviewed dimensions</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.trustReviews.map((item) => item.dimension.replaceAll("_", " ").toLowerCase()).join(", ") || "—"}</td>)}</tr>
        <tr><th scope="row">Completed on Kintovo</th>{compared.map(({ profile }) => <td key={profile.id}>{profile.engagements.length} engagement{profile.engagements.length === 1 ? "" : "s"}</td>)}</tr>
        {context && <tr><th scope="row">Project fit signals</th>{compared.map(({ profile, match }) => <td key={profile.id}>{match?.reasons.join("; ") || "None identified"}</td>)}</tr>}
      </tbody></table></div><p className="field-note" style={{ marginTop: 8 }}>Comparison shows profile information as provided and reviewed. It is not a ranking of overall ability.</p></div></section>}
    {ranked.length ? <div className="talent-grid">{ranked.map(({ profile, match }) => <article className="talent-card" key={profile.id}>
      <span className="talent-avatar" aria-hidden="true">{profile.user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
      <h3>{profile.user.name}</h3><p>{profile.headline ?? "Independent professional"} · {[profile.city, profile.country].filter(Boolean).join(", ")}</p>
      <div className="talent-tags">{profile.categories.slice(0, 4).map((item) => <span className="chip" key={item}>{item}</span>)}{profile.skills.slice(0, 5).map((item) => <span className="chip" key={item}>{item}</span>)}</div>
      <div className="talent-meta"><span className="status-pill green">Profile reviewed</span>{reputation.has(profile.userId) && <span className="status-pill blue">{(reputation.get(profile.userId)!.sum / reputation.get(profile.userId)!.count).toFixed(1)}/5 · {reputation.get(profile.userId)!.count} ratings</span>}{match && <span className="status-pill blue">{match.reasons.length} fit signals</span>}<span className="field-note">{profile.availabilityStatus.replaceAll("_", " ")}{profile.availability ? ` · ${profile.availability}` : ""}</span></div>
      <p className="field-note">Specialist level: {profile.expertiseLevel.replaceAll("_", " ")} · maximum NGN proposal {rateCeilings.find((ceiling) => ceiling.level === profile.expertiseLevel)?.amount.toLocaleString("en-NG") ?? "not configured"}</p>
      {profile.marketExperience && <p className="talent-market">Market experience: {profile.marketExperience}</p>}
      {profile.trustReviews.length > 0 && <div className="talent-tags">{profile.trustReviews.map((review) => <span className="chip" key={review.dimension}>{review.dimension.replaceAll("_", " ")} reviewed</span>)}</div>}
      {match && <div className="match-explanation"><strong>Why this may fit</strong>{match.reasons.length ? <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>No positive fit signals were identified yet.</p>}{match.gaps.length > 0 && <details><summary>Information not confirmed</summary><ul>{match.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></details>}</div>}
      {profile.portfolio.length > 0 && <div className="portfolio-links"><strong>Public work samples</strong>{profile.portfolio.map((item) => <a key={item.id} href={safeExternalHref(item.url) ?? (item.files[0] ? `/api/files/${item.files[0].id}` : undefined)} target="_blank" rel="noreferrer">{item.title}</a>)}</div>}
      {compareIds.includes(profile.id) ? <Link className="text-link" href={withCompare(compareIds.filter((id) => id !== profile.id))}>Remove from comparison</Link> : compareIds.length < 4 && <Link className="text-link" href={withCompare([...compareIds, profile.id])}>Add to comparison</Link>}
      <ShortlistForm profileId={profile.id} projects={projects.map((project) => ({ id: project.id, title: project.title }))} />
    </article>)}</div> : <section className="panel empty-state"><div><h3>{profiles.length ? "No profiles match those filters" : "The curated directory is being prepared"}</h3><p>{profiles.length ? "Adjust the search criteria or remove a filter." : "No specialist profiles are currently approved and published for discovery. Profiles will appear here after a human review."}</p></div></section>}
  </main>;
}
