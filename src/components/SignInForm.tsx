"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.42-.18-2.09H12v3.96h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.26Z" />
    <path fill="#34A853" d="M12 21.67c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.48-4.03H3.27v2.53A9.74 9.74 0 0 0 12 21.67Z" />
    <path fill="#FBBC05" d="M6.52 13.75a5.85 5.85 0 0 1 0-3.5V7.72H3.27a9.75 9.75 0 0 0 0 8.56l3.25-2.53Z" />
    <path fill="#EA4335" d="M12 6.22c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.29 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.73 5.39l3.25 2.53c.78-2.31 2.94-4.03 5.48-4.03Z" />
  </svg>;
}

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
    <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <button className="button button-primary button-wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    {googleConfigured && <><div className="auth-divider"><span>or</span></div>
      <button className="button button-secondary button-wide" type="button" onClick={() => signIn("google", { callbackUrl: "/google-onboarding" })}><GoogleMark />Continue with Google</button></>}
  </form>;
}
