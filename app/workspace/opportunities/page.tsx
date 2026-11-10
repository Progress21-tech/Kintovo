import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { AgreementAcceptanceForm, ProposalActions, ProposalForm, type OfferValues } from "../engagements/EngagementForms";
import { expressInterestInProject } from "./actions";

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const profile = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true, isPublished: true, trustReviews: { where: { dimension: "PORTFOLIO_SKILLS", status: "APPROVED" }, select: { id: true }, take: 1 } } });
  if (!profile) redirect("/workspace/professional");
  const canDiscover = profile.isPublished && profile.trustReviews.length > 0;
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id }, select: { organisationId: true } });
  const [engagements, approvedGoals] = await Promise.all([db.engagement.findMany({
    where: { professionalProfileId: profile.id },
    include: { project: { include: { brief: true, organisation: { select: { name: true } }, createdBy: { select: { id: true, name: true } } } }, proposals: { orderBy: { version: "desc" } }, agreements: { include: { terms: true }, orderBy: { version: "desc" } } },
    orderBy: { updatedAt: "desc" },
  }), canDiscover ? db.project.findMany({
    where: { status: "MATCHING", engagements: { none: { professionalProfileId: profile.id } }, ...(memberships.length ? { organisationId: { notIn: memberships.map((item) => item.organisationId) } } : {}) },
    include: { brief: true, organisation: { select: { name: true } }, workstreams: { select: { recommendedRoles: true } } },
    orderBy: { updatedAt: "desc" }, take: 100,
  }) : Promise.resolve([])]);
  const businessIds = [...new Set(engagements.map((item) => item.project.createdBy.id))];
  const [projectRatings, campaignRatings] = await Promise.all([
    businessIds.length ? db.engagementRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: businessIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
    businessIds.length ? db.campaignRating.groupBy({ by: ["revieweeId"], where: { revieweeId: { in: businessIds } }, _avg: { rating: true }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const businessRatings = new Map<string, { sum: number; count: number }>();
  for (const item of [...projectRatings, ...campaignRatings]) {
    const current = businessRatings.get(item.revieweeId) ?? { sum: 0, count: 0 };
    current.sum += (item._avg.rating ?? 0) * item._count._all;
    current.count += item._count._all;
    businessRatings.set(item.revieweeId, current);
  }
  return <main className="app-main">
    <PageHeader eyebrow="Specialist workspace" title="Project opportunities" description="Browse business goals approved for matching, express interest, and review direct invitations." action={<Link className="button button-secondary" href="/workspace/professional">Professional home</Link>} />
    <section className="review-list"><h2 className="section-subhead">Approved business goals open to Specialists</h2>{!canDiscover && <p className="field-note">Your Specialist profile must pass human review and be published before you can express interest in matching projects.</p>}{approvedGoals.length ? approvedGoals.map((project) => <article className="panel" key={project.id}><div className="panel-header"><div><h2>{project.title}</h2><span className="field-note">{project.organisation.name} · Approved for matching · {project.brief?.targetMarket ?? "Nigeria"}</span></div><span className="status-pill green">Human review passed</span></div><div className="panel-content"><p className="review-objective">{project.brief?.objective}</p><div className="talent-tags">{[...new Set(project.workstreams.flatMap((item) => item.recommendedRoles))].slice(0, 8).map((role) => <span className="chip" key={role}>{role}</span>)}</div><p className="field-note">Deadline: {project.brief?.deadline?.toLocaleDateString("en-NG") ?? "Open"} · Budget: {project.brief && (project.brief.budgetMin !== null || project.brief.budgetMax !== null) ? `${project.brief.currency} ${project.brief.budgetMin?.toLocaleString("en-NG") ?? "—"} to ${project.brief.budgetMax?.toLocaleString("en-NG") ?? "—"}` : "To be agreed"}</p><form action={expressInterestInProject}><input type="hidden" name="projectId" value={project.id} /><button className="button button-primary button-small">Express interest</button><small className="field-note">The business will be notified and can review your published profile before negotiating a proposal.</small></form></div></article>) : canDiscover ? <p className="field-note">No approved Specialist opportunities are open right now.</p> : null}</section>
    {engagements.length ? <div className="opportunity-list">{engagements.map((engagement) => {
      const latest = engagement.proposals[0];
      const agreement = engagement.agreements[0];
      const editable = !agreement && ["INVITED", "PROPOSED", "NEGOTIATING"].includes(engagement.status);
      return <article className="panel opportunity-card" key={engagement.id}>
        <div className="panel-header"><div><h2>{engagement.project.title}</h2><span className="field-note">{engagement.project.organisation.name} · Business contact: {engagement.project.createdBy.name} · {engagement.status.replaceAll("_", " ")}</span>{businessRatings.get(engagement.project.createdBy.id) && <small className="field-note">Business reputation: {(businessRatings.get(engagement.project.createdBy.id)!.sum / businessRatings.get(engagement.project.createdBy.id)!.count).toFixed(1)}/5 · {businessRatings.get(engagement.project.createdBy.id)!.count} ratings</small>}</div><Link className="text-link" href={`/workspace/projects/${engagement.projectId}`}>Open project</Link></div>
        <div className="panel-content">
          <p className="review-objective">{engagement.project.brief?.objective}</p>
          {engagement.message && <p className="notice">Invitation note: {engagement.message}</p>}
          {latest && <section className="offer-summary"><div className="offer-heading"><h3>Latest proposal · version {latest.version}</h3><span className={`status-pill ${latest.status === "ACCEPTED" ? "green" : latest.status === "OPEN" ? "blue" : ""}`}>{latest.status.replaceAll("_", " ")}</span></div><p>{latest.currency} {latest.amount.toLocaleString("en-NG")} · Due {latest.deadline?.toLocaleDateString("en-NG") ?? "to be agreed"}</p><p>{latest.scope}</p><ul>{latest.deliverables.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul><p className="field-note">{latest.revisionAllowance} revision rounds · {latest.usageRights || "Usage rights to be agreed in writing"}</p>
            {latest.status === "OPEN" && latest.authorId !== user.id && <ProposalActions proposal={latest as OfferValues} />}
            {latest.status === "OPEN" && latest.authorId === user.id && <p className="field-note">Waiting for the business to respond. You can withdraw the offer from the project workspace.</p>}
          </section>}
          {agreement && <section className="agreement-summary"><div className="offer-heading"><h3>Agreement version {agreement.version}</h3><span className={`status-pill ${agreement.status === "ACTIVE" ? "green" : "amber"}`}>{agreement.status.replaceAll("_", " ")}</span></div><p>{agreement.terms!.scope}</p><p><strong>{agreement.terms!.currency} {agreement.terms!.amount.toLocaleString("en-NG")}</strong> · {agreement.terms!.deliverables.join(" · ")}</p><p className="field-note">Buyer acceptance: {agreement.buyerAcceptedAt ? "Recorded" : "Pending"} · Professional acceptance: {agreement.talentAcceptedAt ? "Recorded" : "Pending"}</p>{agreement.status === "PENDING_ACCEPTANCE" && !agreement.talentAcceptedAt && <AgreementAcceptanceForm agreementId={agreement.id} />}</section>}
          {engagement.proposals.length > 1 && <details className="offer-history"><summary>Offer history ({engagement.proposals.length} versions)</summary>{engagement.proposals.slice(1).map((offer) => <p key={offer.id}>v{offer.version} · {offer.currency} {offer.amount.toLocaleString("en-NG")} · {offer.status.replaceAll("_", " ")}</p>)}</details>}
          {editable && (!latest || latest.status === "OPEN" && latest.authorId !== user.id) && <details className="proposal-details"><summary>{latest ? "Make a counteroffer" : "Prepare a proposal"}</summary><ProposalForm engagementId={engagement.id} previous={latest as OfferValues | undefined} /></details>}
        </div>
      </article>;
    })}</div> : <section className="panel empty-state"><div><span className="empty-icon">✦</span><h3>No invitations yet</h3><p>When a business invites your published profile to a project, it will appear here.</p></div></section>}
  </main>;
}
