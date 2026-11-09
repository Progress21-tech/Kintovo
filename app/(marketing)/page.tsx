import Link from "next/link";

export default function HomePage() {
  return <main>
    <section className="hero wrap">
      <div>
        <span className="eyebrow">A global-to-Africa execution network</span>
        <h1>Find the people.<br />Build the team.<br /><em>Get the work done.</em></h1>
        <p className="hero-copy">Turn a business goal into a clear project plan, find the African expertise you need, and coordinate the work from one place.</p>
        <div className="hero-actions"><Link className="button button-primary" href="/register">Start with a business goal <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" href="/for-professionals">Join as a professional</Link></div>
        <p className="hero-note"><strong>Nigeria first.</strong> Curated talent · Global and African businesses</p>
      </div>
      <div className="plan-board" aria-label="Illustration of an editable project plan">
        <div className="plan-top"><span className="mini-label">Project discovery</span><span className="mini-pill">Editable plan</span></div>
        <h2 className="plan-title">Launch in Nigeria</h2><p className="plan-subtitle">Introduce a productivity app to university students and young professionals.</p>
        <div className="plan-steps">
          <div className="plan-step"><span className="step-number">01</span><div><div className="step-title">Market research</div><div className="step-desc">Audience + competitor insight</div></div><span className="step-status">RESEARCH</span></div>
          <div className="plan-step"><span className="step-number">02</span><div><div className="step-title">Localised creative</div><div className="step-desc">Messaging + visual assets</div></div><span className="step-status">CREATIVE</span></div>
          <div className="plan-step"><span className="step-number">03</span><div><div className="step-title">Creator distribution</div><div className="step-desc">Relevant audiences + content</div></div><span className="step-status">CREATORS</span></div>
        </div>
        <div className="plan-footer"><span>Recommendations stay editable</span><strong>Human review · Clear agreements</strong></div>
      </div>
    </section>
    <div className="proof-strip wrap"><span>Nigeria-first delivery</span><span>Individual hiring or coordinated teams</span><span>Evidence-led recommendations</span></div>
    <section className="section wrap">
      <div className="section-heading"><div><span className="eyebrow">Two ways to engage</span><h2>One network. Choose the support your goal needs.</h2></div><p>Hire one professional for a defined need, or assemble a project team when your objective needs several capabilities.</p></div>
      <div className="path-grid">
        <article className="path-card"><div className="path-card-top"><span className="eyebrow">Direct hiring</span><span className="status-pill">Individual</span></div><h3>Hire an individual specialist</h3><p>For a clearly defined requirement. Browse profiles, compare evidence, and agree scope and terms directly.</p><div className="path-list"><span className="chip">Graphic designer</span><span className="chip">Video editor</span><span className="chip">Market researcher</span></div></article>
        <article className="path-card primary-path"><div className="path-card-top"><span className="eyebrow">Primary path</span><span className="status-pill coral">Team assembly</span></div><h3>Build a team around the goal</h3><p>Start with the outcome. Review proposed workstreams and assemble the right mix of local expertise.</p><div className="path-list"><span className="chip">Research + local insight</span><span className="chip">Creative + digital</span><span className="chip">Creators + audience</span></div></article>
      </div>
    </section>
    <section className="section wrap">
      <div className="section-heading"><div><span className="eyebrow">From brief to delivery</span><h2>Keep the work, decisions, and next step clear.</h2></div><p>Kintovo brings discovery and delivery into one structured workflow. People stay in control of scope and hiring decisions.</p></div>
      <div className="path-grid">
        <article className="path-card"><span className="mini-label">01 / PLAN</span><h3>Describe what you want to achieve</h3><p>Explain your audience, timing, constraints, and budget. You do not need to know every job title before you begin.</p></article>
        <article className="path-card"><span className="mini-label">02 / DELIVER</span><h3>Agree the work before it starts</h3><p>Compare recommendations, negotiate the details, and document deliverables, milestones, and review rules.</p></article>
      </div>
    </section>
  </main>;
}
