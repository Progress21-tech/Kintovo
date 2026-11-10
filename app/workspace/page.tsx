import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  UserRound,
  UsersRound,
} from "lucide-react";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

const statusClass: Record<string, string> = {
  DRAFT: "", SUBMITTED: "blue", IN_REVIEW: "amber", MATCHING: "coral",
  ACTIVE: "green", COMPLETED: "green", CANCELLED: "",
};

export default async function WorkspacePage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({
    where: { userId: user.id }, include: { organisation: true }, orderBy: { createdAt: "asc" },
  });
  const organisationIds = memberships.map((item) => item.organisationId);
  const [projects, specialist, creator, draftCount, reviewCount, activeCount] = await Promise.all([
    organisationIds.length
      ? db.project.findMany({ where: { organisationId: { in: organisationIds } }, include: { brief: true }, orderBy: { updatedAt: "desc" }, take: 6 })
      : Promise.resolve([]),
    db.professionalProfile.findUnique({ where: { userId: user.id } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: "DRAFT" } }) : Promise.resolve(0),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: { in: ["SUBMITTED", "IN_REVIEW"] } } }) : Promise.resolve(0),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: { in: ["ACTIVE", "MATCHING"] } } }) : Promise.resolve(0),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return <main className="app-main dashboard-main">
    <div className="page-title-row dashboard-heading">
      <div>
        <span className="welcome-label">Workspace <span aria-hidden="true">/</span> Nigeria first</span>
        <h1>Good to see you, {firstName}.</h1>
        <p>Keep your project goals and next steps in view.</p>
      </div>
      {memberships.length > 0 && <Link className="button button-primary dashboard-create" href="/workspace/projects/new"><span aria-hidden="true">+</span> Start with a goal</Link>}
    </div>

    <section className="account-context-grid" aria-label="Your Kintovo workspaces">
      <Link className="account-context-card" href="/workspace/organisations">
        <span className="context-card-icon"><BriefcaseBusiness size={17} aria-hidden="true" /> Business</span>
        <strong>{memberships.length ? `${memberships.length} organisation${memberships.length === 1 ? "" : "s"}` : "Set up an organisation"}</strong>
        <small>Briefs, projects, and team access</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>
      <Link className="account-context-card" href="/workspace/profile?context=SPECIALIST">
        <span className="context-card-icon"><UserRound size={17} aria-hidden="true" /> Specialist</span>
        <strong>{specialist?.onboardingCompletedAt ? specialist.verificationStatus.replaceAll("_", " ") : "Continue profile"}</strong>
        <small>Skills, experience, availability, and work</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>
      <Link className="account-context-card" href="/workspace/profile?context=CREATOR">
        <span className="context-card-icon"><UsersRound size={17} aria-hidden="true" /> Creator</span>
        <strong>{creator?.onboardingCompletedAt ? creator.verificationStatus.replaceAll("_", " ") : "Continue profile"}</strong>
        <small>Content, channels, and optional audience evidence</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>
    </section>

    {!memberships.length && <section className="panel empty-state dashboard-empty">
      <div>
        <span className="empty-icon"><BriefcaseBusiness size={18} aria-hidden="true" /></span>
        <p className="dashboard-empty-kicker">Your next step</p>
        <h2>{specialist || creator ? "Build your professional presence" : "Set up your business workspace"}</h2>
        <p>{specialist || creator ? "Your account is ready. Finish a private profile and submit it when you are ready for human review." : "Create an organisation to start a project brief and invite your team."}</p>
        <div className="empty-actions">
          <Link className="button button-primary" href={specialist || creator ? "/workspace/profile" : "/workspace/organisations"}>Continue setup</Link>
          {(specialist || creator) && <Link className="button button-secondary" href="/workspace/organisations">Add a business</Link>}
        </div>
      </div>
    </section>}

    {memberships.length > 0 && <>
      <section className="dashboard-metrics" aria-label="Project brief summary">
        <div className="dashboard-section-heading"><div><span className="welcome-label">At a glance</span><h2>Project briefs</h2></div><span className="dashboard-updated">Across your organisations</span></div>
        <div className="metric-grid">
          <article className="metric metric-draft"><span><FileText size={16} aria-hidden="true" /> Draft briefs</span><strong>{draftCount}</strong><small>Ready to keep working on</small></article>
          <article className="metric metric-review"><span><Clock3 size={16} aria-hidden="true" /> For review</span><strong>{reviewCount}</strong><small>Submitted or under review</small></article>
          <article className="metric metric-active"><span><CheckCircle2 size={16} aria-hidden="true" /> Active work</span><strong>{activeCount}</strong><small>Matching or in progress</small></article>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel dashboard-projects">
          <div className="panel-header"><div><span className="welcome-label">Your work</span><h2>Recent project briefs</h2></div><Link className="text-link dashboard-view-all" href="/workspace/projects">View all <ArrowRight size={15} aria-hidden="true" /></Link></div>
          {projects.length ? <div className="panel-content project-list">{projects.map((project) => <Link className="project-row" key={project.id} href={`/workspace/projects/${project.id}`}>
            <span className="project-row-icon"><BriefcaseBusiness size={17} aria-hidden="true" /></span>
            <span className="project-row-main"><strong>{project.title}</strong><small>{project.brief?.targetMarket ?? "Nigeria"} <span aria-hidden="true">·</span> Updated {project.updatedAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</small></span>
            <span className="project-path">{project.path === "TEAM" ? "Team assembly" : project.path === "INDIVIDUAL" ? "Individual" : "Plan first"}</span>
            <span className={`status-pill ${statusClass[project.status] ?? ""}`}>{project.status.replaceAll("_", " ")}</span>
          </Link>)}</div> : <div className="empty-state"><div><span className="empty-icon"><BriefcaseBusiness size={17} aria-hidden="true" /></span><h3>Your first project starts with a goal</h3><p>Share the outcome you want to reach. Kintovo will suggest the capabilities that may help.</p><Link className="button button-primary" href="/workspace/projects/new">Create a project brief</Link></div></div>}
        </section>

        <section className="panel dashboard-next-steps">
          <div className="panel-header"><div><span className="welcome-label">A useful reminder</span><h2>Plan with clarity</h2></div></div>
          <div className="panel-content action-list">
            <div className="action-item"><span className="action-item-icon action-coral"><BriefcaseBusiness size={16} aria-hidden="true" /></span><div><strong>Start with the outcome</strong><span>Describe what success looks like before selecting roles.</span></div></div>
            <div className="action-item"><span className="action-item-icon action-teal"><UsersRound size={16} aria-hidden="true" /></span><div><strong>Shape the work together</strong><span>Review and edit suggested workstreams before moving ahead.</span></div></div>
            <div className="action-item"><span className="action-item-icon action-amber"><CircleDollarSign size={16} aria-hidden="true" /></span><div><strong>Keep terms transparent</strong><span>Agreements record scope, fees, and review expectations.</span></div></div>
          </div>
          <Link className="dashboard-tip-link" href="/workspace/projects/new">Create a project brief <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      </div>
    </>}
  </main>;
}
