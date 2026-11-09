import Link from "next/link";
import { Brand } from "@/components/Brand";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const initialContext = as === "creator" ? "CREATOR" : as === "specialist" ? "SPECIALIST" : "BUSINESS";
  return <main className="auth-page">
    <aside className="auth-aside"><div><Brand href="/" inverse /><div style={{ marginTop: 58 }}><span className="auth-kicker">Start with the outcome</span><h1>Bring your goal.<br />Build the right team.</h1><p>Kintovo helps businesses turn a business objective into a practical plan and connect with African specialists.</p></div></div><span className="auth-aside-foot">One network · Two ways to engage</span></aside>
    <section className="auth-main"><div className="auth-card"><h2>Create your account</h2><p>Choose a business, professional, or creator account context. You can add another context later.</p><RegisterForm initialContext={initialContext} /><p className="auth-bottom">Already have an account? <Link href="/sign-in">Sign in</Link></p></div></section>
  </main>;
}
