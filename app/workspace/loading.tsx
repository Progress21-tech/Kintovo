/**
 * Shown instantly while a workspace page renders on the server, so navigation
 * responds immediately instead of waiting on database queries. The sidebar and
 * top bar stay in place because they belong to the layout.
 */
export default function WorkspaceLoading() {
  return <main className="app-main" aria-busy="true" aria-live="polite">
    <span className="visually-hidden">Loading…</span>
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-line" />
    <div className="skeleton-grid">
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
    </div>
    <div className="skeleton skeleton-panel" />
  </main>;
}
