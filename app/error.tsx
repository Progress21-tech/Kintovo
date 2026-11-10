"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("Application route failed", { digest: error.digest });
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-main">
        <div className="auth-card" role="alert">
          <span className="auth-kicker">Something went wrong</span>
          <h1>We couldn’t complete that request.</h1>
          <p>Please try again. If the problem continues, return to the home page and try again later.</p>
          {error.digest && <p className="field-note">Reference: {error.digest}</p>}
          <div className="inline-form">
            <button className="button button-primary" onClick={() => unstable_retry()}>Try again</button>
            <Link className="button button-secondary" href="/">Go to home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
