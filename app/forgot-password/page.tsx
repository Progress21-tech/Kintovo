import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ResetRequestForm } from "./ResetRequestForm";

export default function ForgotPasswordPage() {
  return <main className="auth-page"><aside className="auth-aside"><div><Brand href="/" inverse /><div style={{ marginTop: 58 }}><span className="auth-kicker">Account access</span><h1>Get back to your work.</h1><p>We’ll send a one-time password reset link if the account exists.</p></div></div></aside><section className="auth-main"><div className="auth-card"><h2>Reset your password</h2><p>Enter the email address used for your Kintovo account.</p><ResetRequestForm /><p className="auth-bottom"><Link href="/sign-in">Return to sign in</Link></p></div></section></main>;
}
