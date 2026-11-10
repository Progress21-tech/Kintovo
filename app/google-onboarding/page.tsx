import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Brand } from "@/components/Brand";
import { db } from "@/server/db";
import { GoogleOnboardingForm } from "./GoogleOnboardingForm";

export default async function GoogleOnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const [membership, specialist, creator] = await Promise.all([
    db.organisationMembership.findFirst({ where: { userId: session.user.id }, select: { id: true } }),
    db.professionalProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } }),
  ]);
  if (membership || specialist || creator) redirect("/workspace");
  return <main className="auth-page"><aside className="auth-aside"><div><Brand href="/" inverse /><div style={{ marginTop: 58 }}><span className="auth-kicker">One clear next step</span><h1>Tell Kintovo how you’ll work.</h1><p>Choose your account context and add the details needed to prepare your workspace.</p></div></div></aside><section className="auth-main"><div className="auth-card"><h2>Finish your Google signup</h2><p>Your Google email is already verified. Complete this short setup to create the right workspace.</p><GoogleOnboardingForm /></div></section></main>;
}
