import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { canInviteOrganisationMembers } from "@/server/permissions";
import { CreateOrganisationForm, InviteMemberForm } from "./OrganisationForms";

export default async function OrganisationsPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const user = await requireUser();
  const { invite } = await searchParams;
  const memberships = await db.organisationMembership.findMany({
    where: { userId: user.id },
    include: {
      organisation: {
        include: {
          memberships: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
            take: 50,
          },
          invitations: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return <main className="app-main">
    <PageHeader eyebrow="Business setup" title="Organisations and people" description="Manage the businesses connected to your account and give each member only the access they need." />
    {invite === "accepted" && <div className="form-success org-notice" role="status">You joined the organisation. Its projects will now appear in your workspace.</div>}
    {invite === "expired" && <div className="form-alert org-notice" role="alert">That invitation expired or has already been used. Ask an organisation owner to send a new one.</div>}
    {invite === "email-mismatch" && <div className="form-alert org-notice" role="alert">Sign in with the email address the invitation was sent to.</div>}
    {invite === "already-member" && <div className="notice org-notice" role="status">You already have access to this organisation. Your current role was left unchanged.</div>}
    {invite === "invalid" && <div className="form-alert org-notice" role="alert">That invitation link is not valid.</div>}

    <div className="organisation-layout">
      <div className="organisation-list">
        {memberships.length === 0 && <Panel title="Create your business workspace"><div className="panel-content"><p className="org-intro">Add a business to manage briefs, projects and authorised team members. You can also join a business using an invitation sent to your account email.</p></div></Panel>}
        {memberships.map((membership) => <Panel key={membership.organisationId} title={membership.organisation.name} action={<span className="status-pill blue">{membership.role.replaceAll("_", " ")}</span>}>
          <div className="panel-content">
            <p className="org-meta">{[membership.organisation.industry, membership.organisation.location, membership.organisation.website].filter(Boolean).join(" · ") || "Organisation details can be completed as your workspace grows."}</p>
            <h3 className="org-subhead">Members</h3>
            <ul className="member-list">{membership.organisation.memberships.map((member) => <li key={member.id}><span><strong>{member.user.name}</strong><small>{member.user.email}</small></span><span className="status-pill">{member.role.replaceAll("_", " ")}{member.canApproveSpend ? " · spend approval" : ""}</span></li>)}</ul>
            {membership.organisation.invitations.length > 0 && <><h3 className="org-subhead">Pending invitations</h3><ul className="member-list">{membership.organisation.invitations.map((item) => <li key={item.id}><span><strong>{item.email}</strong><small>Expires {item.expiresAt.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</small></span><span className="status-pill amber">{item.role.replaceAll("_", " ")}</span></li>)}</ul></>}
            {canInviteOrganisationMembers(membership.role) ? <details className="invite-details"><summary>Invite an organisation member</summary><div className="invite-details-content"><InviteMemberForm organisationId={membership.organisationId} actorRole={membership.role} /></div></details> : <p className="field-note">Ask an owner or administrator to manage invitations.</p>}
          </div>
        </Panel>)}
      </div>
      <Panel title="Add an organisation"><div className="panel-content"><CreateOrganisationForm /></div></Panel>
    </div>
  </main>;
}
