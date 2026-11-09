import Link from "next/link";
import { Brand } from "@/components/Brand";
import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="auth-page"><aside className="auth-aside"><div><Brand href="/" inverse /><div style={{ marginTop: 58 }}><span className="auth-kicker">Account access</span><h1>Choose a new password.</h1></div></div></aside><section className="auth-main"><div className="auth-card"><h2>Reset your password</h2><p>Set a new password for your Kintovo account.</p><ResetForm token={token} /><p className="auth-bottom"><Link href="/sign-in">Return to sign in</Link></p></div></section></main>;
}
