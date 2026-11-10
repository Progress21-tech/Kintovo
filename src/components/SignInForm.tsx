"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { GoogleMark } from "@/components/GoogleMark";

export function SignInForm({ googleConfigured = false }: { googleConfigured?: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    setError("");
    setPending(true);
    try {
      const result = await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirect: false, redirectTo: "/workspace" });
      if (result?.error) setError("We couldn’t sign you in. Check your details and verify your email address.");
      else window.location.assign("/workspace");
    } catch {
      setError("Sign-in is temporarily unavailable. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }
  return <form action={submit} className="form-stack">
    <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
    <label>Password<div className="password-label-row"><span>Password</span><Link href="/forgot-password">Forgot password?</Link></div><input type="password" name="password" autoComplete="current-password" required /></label>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    {googleConfigured && <><div className="auth-divider"><span>or</span></div>
      <button className="button button-secondary button-wide" type="button" onClick={() => signIn("google", { callbackUrl: "/google-onboarding" })}><GoogleMark />Continue with Google</button></>}
  </form>;
}
