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
      if (result?.error) {
        console.warn("[Kintovo auth] browser credentials sign-in failed", { error: result.error, status: result.status, url: result.url });
        setError("We couldn’t sign you in. Check your email and password, then try again.");
      } else {
        console.info("[Kintovo auth] browser credentials sign-in accepted");
        window.location.assign("/workspace");
      }
    } catch {
      console.error("[Kintovo auth] browser credentials sign-in request failed");
      setError("Sign-in is temporarily unavailable. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }
  return <form action={submit} className="form-stack">
    <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
    <div className="password-field"><div className="password-label-row"><label htmlFor="sign-in-password">Password</label><Link href="/forgot-password">Forgot password?</Link></div><input id="sign-in-password" type="password" name="password" autoComplete="current-password" required /></div>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    {googleConfigured && <><div className="auth-divider"><span>or</span></div>
      <button className="button button-secondary button-wide" type="button" onClick={() => signIn("google", { callbackUrl: "/google-onboarding" })}><GoogleMark />Continue with Google</button></>}
  </form>;
}
