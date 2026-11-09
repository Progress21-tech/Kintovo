"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function SignInForm() {
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
    <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
  </form>;
}
