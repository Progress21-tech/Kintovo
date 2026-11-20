import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getSessionUser } from "@/server/access";
import { privacyVersion, termsVersion } from "@/server/policies";
import { PolicyAcceptanceForm } from "./PolicyAcceptanceForm";

export default async function ConsentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  if (user.unavailable) redirect(user.revoked ? "/sign-in?notice=session-expired" : "/sign-in?notice=account-unavailable");
  if (user.termsVersion === termsVersion && user.privacyVersion === privacyVersion) redirect("/workspace");
  return <main className="auth-page">
    <aside className="auth-aside"><Brand href="/" inverse /><div><span className="auth-kicker">Account agreement</span><h1>Review the current documents.</h1><p>To continue using Kintovo, accept the current Terms of Service and acknowledge the Privacy Notice.</p></div><span className="auth-aside-foot">Terms {termsVersion} · Privacy {privacyVersion}</span></aside>
    <section className="auth-main"><div className="auth-card"><h2>Continue to Kintovo</h2><p>Hello {user.name}. Both documents are product-specific drafts pending qualified legal review.</p><ul className="policy-summary"><li><Link href="/terms" target="_blank">Read the Terms of Service</Link></li><li><Link href="/privacy" target="_blank">Read the Privacy Notice</Link></li></ul><PolicyAcceptanceForm /></div></section>
  </main>;
}
