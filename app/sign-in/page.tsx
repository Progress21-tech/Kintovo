import Link from "next/link";
import { Brand } from "@/components/Brand";
import { SignInForm } from "@/components/SignInForm";

const notices: Record<string, string> = {
  "email-verified": "Your email is verified. You can sign in now.",
  "invalid-link": "That verification link is invalid.",
  "expired-link": "That link is expired or has already been used.",
  "password-updated": "Your password has been updated. Sign in with the new password.",
  "account-unavailable": "This account is unavailable. Contact platform support.",
  "google-email-missing": "Google did not provide an email address for this account. Check your Google account permissions and try again.",
  "google-email-unverified": "Google could not verify this email address. Use a verified Google account or sign in with your Kintovo password.",
  "sign-in-denied": "Sign-in was denied. Check your account status or try another sign-in method.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const { notice, error } = await searchParams;
  const displayedNotice = notice ?? (error === "AccessDenied" ? "sign-in-denied" : undefined);
  return <main className="auth-page">
    <aside className="auth-aside"><div><Brand href="/" inverse /><div style={{ marginTop: 58 }}><span className="auth-kicker">A clearer path to local execution</span><h1>Let’s get the right work moving.</h1><p>Sign in to continue a brief, review a project, or manage your professional profile.</p></div></div><span className="auth-aside-foot">Nigeria first · African talent · Global and regional businesses</span></aside>
    <section className="auth-main"><div className="auth-card"><h2>Welcome back</h2><p>Sign in with the email address linked to your account.</p>{displayedNotice && notices[displayedNotice] && <div className="notice" role="status">{notices[displayedNotice]}</div>}<SignInForm googleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} /><p className="auth-bottom"><Link href="/forgot-password">Forgot your password?</Link></p><p className="auth-bottom">New to Kintovo? <Link href="/register">Create an account</Link></p></div></section>
  </main>;
}
