"use client";

import { useEffect } from "react";

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("Root application render failed", { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f5f0", color: "#202522", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
        <main style={{ width: "min(100% - 32px, 560px)", padding: 32, border: "1px solid #e5e0d7", borderRadius: 8, background: "#ffffff" }}>
          <p style={{ color: "#b7473b", fontWeight: 500, fontSize: 13 }}>Something went wrong</p>
          <h1 style={{ fontWeight: 400, letterSpacing: "-0.02em" }}>We couldn’t load this page.</h1>
          <p style={{ color: "#68716c" }}>Please try again. If the problem continues, return to the site later.</p>
          {error.digest && <p>Reference: {error.digest}</p>}
          <button onClick={() => unstable_retry()} style={{ padding: "12px 18px", border: 0, borderRadius: 5, background: "#e45a3d", color: "#ffffff", cursor: "pointer", fontWeight: 500 }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
