import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { AgreementAcceptanceForm, ProposalActions, ProposalForm, type OfferValues } from "../engagements/EngagementForms";

export default async function OpportunitiesPage() {
  const user = await requireUser();
  const profile = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!profile) redirect("/workspace/professional");
  const engagements = await db.engagement.findMany({
    where: { professionalProfileId: profile.id },
    include: { project: { include: { brief: true, organisation: { select: { name: true } } } }, proposals: { orderBy: { version: "desc" } }, agreements: { include: { terms: true }, orderBy: { version: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return <main className="app-main">
    <PageHeader eyebrow="Specialist workspace" title="Project opportunities" description="Review direct invitations, submit a proposal, and negotiate terms with a versioned offer history." action={<Link className="button button-secondary" href="/workspace/professional">Professional home</Link>} />
    {engagements.length ? <div className="opportunity-list">{engagements.map((engagement) => {
      const latest = engagement.proposals[0];
      const agreement = engagement.agreements[0];
      const editable = !agreement && ["INVITED", "PROPOSED", "NEGOTIATING"].includes(engagement.status);
      return <article className="panel opportunity-card" key={engagement.id}>
        <div className="panel-header"><div><h2>{engagement.project.title}</h2><span className="field-note">{engagement.project.organisation.name} · {engagement.status.replaceAll("_", " ")}</span></div><Link className="text-link" href={`/workspace/projects/${engagement.projectId}`}>Open project</Link></div>
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
