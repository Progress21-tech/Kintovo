import Link from "next/link";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { Brand } from "@/components/Brand";
import { db } from "@/server/db";
import { acceptOrganisationInvitation } from "../../workspace/organisations/actions";

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const validToken = /^[a-f0-9]{64}$/i.test(token);
  const session = await auth();
  const invitation = validToken ? await db.organisationInvitation.findUnique({ where: { token: createHash("sha256").update(token).digest("hex") }, include: { organisation: { select: { name: true } } } }) : null;
  const invitationIsValid = Boolean(invitation && !invitation.acceptedAt && invitation.expiresAt > new Date());
  return <main className="auth-page">
    <aside className="auth-aside"><Brand href="/" inverse /><div><span className="auth-kicker">Organisation invitation</span><h1>Work together with clarity.</h1><p>Organisation access follows a specific role and may include separate spend approval.</p></div><span className="auth-aside-foot">Kintovo · Nigeria first</span></aside>
    <section className="auth-main"><div className="auth-card">
      {!invitationIsValid ? <><h2>Invitation unavailable</h2><p>This invitation may have expired or already been accepted. Ask an organisation owner to send another one.</p><Link className="button button-secondary" href="/workspace/organisations">Open organisations</Link></> : <>
        <h2>Join {invitation!.organisation.name}</h2>
        <p>Invitation for <strong>{invitation!.email}</strong> as <strong>{invitation!.role.toLowerCase().replaceAll("_", " ")}</strong>{invitation!.canApproveSpend ? ", with spend approval authority" : ""}.</p>
        {!session?.user?.id ? <><div className="notice">Sign in using the invited email address to accept this invitation. If you need to verify your email or create an account, return to this invitation link afterwards.</div><Link className="button button-primary button-wide" href="/sign-in">Sign in to continue</Link></> : session.user.email?.toLowerCase() !== invitation!.email.toLowerCase() ? <div className="form-alert" role="alert">You are signed in as a different email. Sign out and return to this link with the invited account.</div> : <form action={acceptOrganisationInvitation}><input type="hidden" name="token" value={token} /><button className="button button-primary button-wide">Accept invitation</button></form>}
      </>}
    </div></section>
  </main>;
}
