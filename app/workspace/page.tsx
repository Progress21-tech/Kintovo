import Link from "next/link";
import { redirect } from "next/navigation";
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
  if (!memberships.length && ["ADMIN", "OPERATIONS", "FINANCE"].includes(user.platformRole)) redirect("/workspace/operations");
  const [projects, specialist, creator, draftCount, reviewCount, activeCount, specialistEngagements, specialistTasks, creatorCampaigns, creatorContent] = await Promise.all([
    organisationIds.length
      ? db.project.findMany({ where: { organisationId: { in: organisationIds } }, include: { brief: true }, orderBy: { updatedAt: "desc" }, take: 6 })
      : Promise.resolve([]),
    db.professionalProfile.findUnique({ where: { userId: user.id } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: "DRAFT" } }) : Promise.resolve(0),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: { in: ["SUBMITTED", "IN_REVIEW"] } } }) : Promise.resolve(0),
    organisationIds.length ? db.project.count({ where: { organisationId: { in: organisationIds }, status: { in: ["ACTIVE", "MATCHING"] } } }) : Promise.resolve(0),
    db.engagement.count({ where: { professional: { userId: user.id }, status: { notIn: ["CANCELLED", "COMPLETED"] } } }),
    db.projectTask.count({ where: { assignee: { userId: user.id }, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "SUBMITTED"] } } }),
    db.campaignCreator.count({ where: { creator: { userId: user.id }, status: { notIn: ["DECLINED", "COMPLETED"] } } }),
    db.campaignContent.count({ where: { campaignCreator: { creator: { userId: user.id } }, status: { in: ["SUBMITTED", "REVISION_REQUESTED"] } } }),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const hasBusiness = memberships.length > 0;
  const hasProfessional = !!specialist;
  const hasCreator = !!creator;
  const primaryHref = hasBusiness ? "/workspace/projects/new" : hasCreator ? "/workspace/profile?context=CREATOR" : "/workspace/profile?context=SPECIALIST";
  const primaryLabel = hasBusiness ? "Start with a goal" : hasCreator ? "Complete creator profile" : "Complete specialist profile";

  return <main className="app-main dashboard-main">
    <div className="page-title-row dashboard-heading">
      <div>
        <span className="welcome-label">Workspace <span aria-hidden="true">/</span> Nigeria first</span>
        <h1>Good to see you, {firstName}.</h1>
        <p>Keep your project goals and next steps in view.</p>
      </div>
      <Link className="button button-primary dashboard-create" href={primaryHref}><span aria-hidden="true">+</span> {primaryLabel}</Link>
    </div>

    <section className="account-context-grid" aria-label="Your Kintovo workspaces">
      {hasBusiness && <Link className="account-context-card" href="/workspace/organisations">
        <span className="context-card-icon"><BriefcaseBusiness size={17} aria-hidden="true" /> Business</span>
        <strong>{memberships.length ? `${memberships.length} organisation${memberships.length === 1 ? "" : "s"}` : "Set up an organisation"}</strong>
        <small>Briefs, projects, and team access</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>}
      {hasProfessional && <Link className="account-context-card" href="/workspace/professional">
        <span className="context-card-icon"><UserRound size={17} aria-hidden="true" /> Specialist</span>
        <strong>{specialist?.onboardingCompletedAt ? specialist.verificationStatus.replaceAll("_", " ") : "Continue profile"}</strong>
        <small>Skills, experience, availability, and work</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>}
      {hasCreator && <Link className="account-context-card" href="/workspace/campaigns">
        <span className="context-card-icon"><UsersRound size={17} aria-hidden="true" /> Creator</span>
        <strong>{creator?.onboardingCompletedAt ? creator.verificationStatus.replaceAll("_", " ") : "Continue profile"}</strong>
        <small>Content, channels, and optional audience evidence</small>
        <ArrowRight className="context-arrow" size={16} aria-hidden="true" />
      </Link>}
    </section>

    {!hasBusiness && (hasProfessional || hasCreator) && <section className="panel empty-state dashboard-empty">
      <div>
        <span className="empty-icon"><BriefcaseBusiness size={18} aria-hidden="true" /></span>
        <p className="dashboard-empty-kicker">Your next step</p>
        <h2>{hasCreator && !hasProfessional ? "Build your creator presence" : "Build your professional presence"}</h2>
        <p>{hasCreator && !hasProfessional ? "Complete your creator profile to receive campaign invitations and keep your content work ready for review." : "Your account is ready. Finish a private profile and submit it when you are ready for human review."}</p>
        <div className="empty-actions">
          <Link className="button button-primary" href={hasCreator && !hasProfessional ? "/workspace/profile?context=CREATOR" : "/workspace/profile?context=SPECIALIST"}>Continue setup</Link>
          <Link className="button button-secondary" href="/workspace/organisations">Add a business</Link>
        </div>
      </div>
    </section>}

    {hasProfessional && <section className="role-dashboard-section" aria-label="Specialist workspace">
      <div className="dashboard-section-heading"><div><span className="welcome-label">Specialist workspace</span><h2>Professional work</h2></div><Link className="text-link" href="/workspace/professional">Open professional home <span aria-hidden="true">→</span></Link></div>
      <div className="metric-grid role-metric-grid"><article className="metric"><span>Open opportunities</span><strong>{specialistEngagements}</strong><small>Invitations and active engagements</small></article><article className="metric"><span>Tasks needing attention</span><strong>{specialistTasks}</strong><small>Assigned delivery tasks</small></article></div>
      <div className="role-dashboard-grid"><article className="panel role-dashboard-card"><div className="panel-content"><span className="welcome-label">Next step</span><h2>Find the right opportunity</h2><p>Review invitations, compare proposals, and keep your professional profile ready for matching.</p><div className="empty-actions"><Link className="button button-primary button-small" href="/workspace/opportunities">View opportunities</Link><Link className="button button-secondary button-small" href="/workspace/profile/trust">Manage evidence</Link></div></div></article>
      <article className="panel role-dashboard-card"><div className="panel-content"><span className="welcome-label">Profile readiness</span><h2>{specialist?.onboardingCompletedAt ? "Submitted for review" : "Complete your profile"}</h2><p>{specialist?.onboardingCompletedAt ? "Your profile is in the review workflow. Keep your availability and work samples current." : "Add your skills, experience, availability, and public work samples before submitting."}</p><Link className="text-link" href="/workspace/profile?context=SPECIALIST">Open specialist profile <span aria-hidden="true">→</span></Link></div></article>
      </div>
    </section>}

    {hasCreator && <section className="role-dashboard-section" aria-label="Creator workspace">
      <div className="dashboard-section-heading"><div><span className="welcome-label">Creator workspace</span><h2>Campaign work</h2></div><Link className="text-link" href="/workspace/campaigns">Open campaigns <span aria-hidden="true">→</span></Link></div>
      <div className="metric-grid role-metric-grid"><article className="metric"><span>Campaign opportunities</span><strong>{creatorCampaigns}</strong><small>Invitations and active campaigns</small></article><article className="metric"><span>Content needing review</span><strong>{creatorContent}</strong><small>Submitted or changes requested</small></article></div>
      <div className="role-dashboard-grid"><article className="panel role-dashboard-card"><div className="panel-content"><span className="welcome-label">Next step</span><h2>Manage campaign opportunities</h2><p>Review invitations, prepare content, and keep track of referral activity and approved conversions.</p><div className="empty-actions"><Link className="button button-primary button-small" href="/workspace/campaigns">Open campaigns</Link><Link className="button button-secondary button-small" href="/workspace/profile?context=CREATOR">Edit profile</Link></div></div></article>
      <article className="panel role-dashboard-card"><div className="panel-content"><span className="welcome-label">Profile readiness</span><h2>{creator?.onboardingCompletedAt ? "Submitted for review" : "Complete your creator profile"}</h2><p>{creator?.onboardingCompletedAt ? "Your creator profile is in the review workflow. Keep channels and audience context current." : "Add your content categories, platforms, and optional audience evidence before submitting."}</p><Link className="text-link" href="/workspace/profile?context=CREATOR">Open creator profile <span aria-hidden="true">→</span></Link></div></article>
      </div>
    </section>}

    {hasBusiness && <>
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
