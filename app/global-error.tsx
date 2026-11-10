"use client";

import { useEffect } from "react";

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("Root application render failed", { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f7f4", color: "#18211b", fontFamily: "Arial, sans-serif" }}>
        <main style={{ width: "min(100% - 32px, 560px)", padding: 32, borderRadius: 16, background: "white", boxShadow: "0 12px 40px #18211b14" }}>
          <p style={{ color: "#a75238", fontWeight: 700 }}>Something went wrong</p>
          <h1>We couldn’t load this page.</h1>
          <p>Please try again. If the problem continues, return to the site later.</p>
          {error.digest && <p>Reference: {error.digest}</p>}
          <button onClick={() => unstable_retry()} style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: "#235c45", color: "white", cursor: "pointer" }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
