import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";

const faqs = [
  { q: "Do I need to know which roles to hire?", a: "No. Describe the goal, audience, timing and budget. Kintovo drafts workstreams and roles you can edit, remove or replace before anyone is invited." },
  { q: "Does Kintovo hold payments in escrow?", a: "No. Kintovo records agreed fees, milestones and payment status. It is not an escrow provider or a custodian of funds, and any test or sandbox payment is labelled as one." },
  { q: "How are professionals checked?", a: "People on the Kintovo team review each area separately: portfolio and authorship, local-market expertise and, where requested, identity. No single badge stands in for all of them." },
  { q: "Are creators treated as affiliates?", a: "No. A campaign can pay a fixed fee, a fee plus a performance bonus, or commission only. The rules, including how refunds count, are agreed before work starts." },
  { q: "What happens if delivery goes wrong?", a: "Revisions follow the agreed allowance, scope changes need both parties to accept, and disputes go to a named reviewer with the agreement version and evidence attached." },
  { q: "Where does Kintovo operate?", a: "Delivery starts in Nigeria. Businesses can be based anywhere. More markets come later, once the first one works well." },
];

export default function HomePage() {
  return <main className="home">
    <section className="home-hero backdrop">
      <div className="wrap home-hero-inner">
        <span className="eyebrow eyebrow-centred">Nigeria first · African talent · Global businesses</span>
        <h1>Find the people.<br />Build the team.</h1>
        <p className="home-hero-copy">Describe a business goal. Kintovo turns it into an editable plan, suggests reviewed specialists and creators, and keeps agreements and milestones in one place.</p>
        <div className="home-hero-actions">
          <Link className="button button-primary button-icon" href="/register">Start with a business goal <ArrowRight className="icon-slide" size={16} aria-hidden="true" /></Link>
          <Link className="button button-secondary" href="/#professionals">Join as a professional</Link>
        </div>
      </div>
      <div className="wrap hero-peek" aria-label="Example of an editable project plan">
        <div className="peek-frame">
          <div className="peek-bar"><span className="peek-dot" /><span className="peek-dot" /><span className="peek-dot" /><span className="peek-crumb">Projects / Launch in Nigeria</span></div>
          <div className="peek-body">
            <div className="peek-plan">
              <div className="peek-head"><span className="mini-label">Draft plan</span><span className="mini-pill">Editable</span></div>
              <p className="peek-title">Launch a study app for Nigerian university students</p>
              {[
                ["01", "Audience research", "Interviews and segment map"],
                ["02", "Localised creative", "Messaging and five launch videos"],
                ["03", "Creator distribution", "Three campus creators"],
              ].map(([n, title, desc]) => <div className="peek-step" key={n}><span className="step-number">{n}</span><div><div className="step-title">{title}</div><div className="step-desc">{desc}</div></div><span className="peek-edit">Edit</span></div>)}
            </div>
            <div className="peek-team">
              <span className="mini-label">Suggested team</span>
              {[
                ["AE", "Market researcher", "Skill overlap · Nigeria experience"],
                ["KO", "Video editor", "Short-form samples reviewed"],
                ["TB", "Campus creator", "Fixed fee + bonus"],
              ].map(([initials, role, why]) => <div className="peek-person" key={role}><span className="talent-avatar">{initials}</span><div><div className="step-title">{role}</div><div className="step-desc">{why}</div></div></div>)}
              <p className="peek-note">You approve every invitation.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="wrap home-section home-problem">
      <div className="home-heading">
        <span className="eyebrow">The problem</span>
        <h2>Most teams know the goal.<br />Few know who to hire.</h2>
      </div>
      <div className="problem-grid">
        <article><h3>Job titles come first</h3><p>Hiring starts with roles you have to guess, before anyone has looked at the goal.</p></article>
        <article><h3>Work lives in chats</h3><p>Scope, files and approvals end up scattered across messages nobody can find later.</p></article>
        <article><h3>Terms drift</h3><p>Without a signed version, every revision and payment becomes a negotiation.</p></article>
      </div>
    </section>

    <section className="home-band" id="how-it-works">
      <div className="wrap">
        <div className="home-heading home-heading-inverse">
          <span className="eyebrow">How it works</span>
          <h2>From goal to delivered work.<br /><span>People stay in charge.</span></h2>
        </div>
        <div className="bento">
          <article className="bento-card bento-wide">
            <div className="bento-visual">
              <div className="mini-row"><span className="chip">Audience research</span><span className="chip">Localised creative</span><span className="chip chip-dashed">+ Add workstream</span></div>
              <div className="mini-tag">Rules-based draft · review before submitting</div>
            </div>
            <h3>Plan</h3><p>Describe the goal and get workstreams, roles, deliverables and open questions. Accept, edit or remove any of them.</p>
          </article>
          <article className="bento-card">
            <div className="bento-visual"><ul className="mini-list"><li>Skill overlap: video editing</li><li>Market experience mentions Nigeria</li><li className="muted">Rate not stated</li></ul></div>
            <h3>Match</h3><p>See why someone may fit, and what they have not confirmed. No single score.</p>
          </article>
          <article className="bento-card">
            <div className="bento-visual"><div className="mini-versions"><span>v1 · ₦420,000</span><span>v2 · ₦380,000</span><span className="accepted">Accepted</span></div></div>
            <h3>Agree</h3><p>Offers and counteroffers keep their history. Accepted terms become a versioned agreement.</p>
          </article>
          <article className="bento-card">
            <div className="bento-visual"><ol className="mini-steps"><li className="done">Submitted</li><li className="done">Revision 1 of 2</li><li>Approved</li></ol></div>
            <h3>Deliver</h3><p>Tasks, messages, files and milestones with review windows and revision limits.</p>
          </article>
          <article className="bento-card">
            <div className="bento-visual"><div className="mini-ledger"><span>Research synthesis</span><span>₦600,000</span><span className="simulated-badge">Simulated</span></div><div className="mini-ledger"><span>Launch video set</span><span>₦350,000</span><span className="mini-state">Awaiting review</span></div></div>
            <h3>Keep records</h3><p>Every fee, approval and payment state is recorded and labelled. Kintovo records obligations; it does not hold funds.</p>
          </article>
        </div>
      </div>
    </section>

    <section className="wrap home-section">
      <div className="home-heading">
        <span className="eyebrow">Two ways to engage</span>
        <h2>Hire one specialist,<br />or build a team.</h2>
      </div>
      <div className="path-grid">
        <article className="path-card primary-path"><div className="path-card-top"><span className="mini-label">Primary path</span><span className="status-pill coral">Team assembly</span></div><h3>Build a team around the goal</h3><p>Start with the outcome, review the suggested workstreams, and choose the mix of local expertise the work needs.</p></article>
        <article className="path-card"><div className="path-card-top"><span className="mini-label">Direct hiring</span><span className="status-pill">Individual</span></div><h3>Hire for a defined need</h3><p>Pick a role, browse reviewed profiles, compare evidence side by side, and agree scope and terms directly.</p></article>
      </div>
    </section>

    <section className="wrap home-section">
      <div className="home-heading">
        <span className="eyebrow">Who it is for</span>
        <h2>Built for both sides<br />of the work.</h2>
      </div>
      <div className="audience-grid">
        <article id="businesses" className="audience-section"><span className="mini-label">Businesses</span><h3>Local execution, shaped around your objective</h3><p>For global and African businesses that want to understand, enter or grow in Nigeria without building a local team first.</p><Link className="text-link link-arrow" href="/register">Plan a project <ArrowUpRight size={14} aria-hidden="true" /></Link></article>
        <article id="professionals" className="audience-section"><span className="mini-label">Professionals</span><h3>Show your evidence, agree clear terms</h3><p>Present work samples and your own contribution, propose rates and deliverables, and keep every accepted version.</p><Link className="text-link link-arrow" href="/register?as=specialist">Create a professional account <ArrowUpRight size={14} aria-hidden="true" /></Link></article>
        <article id="creators" className="audience-section"><span className="mini-label">Creators</span><h3>Campaigns with the rules written down</h3><p>Fixed fee, fee plus bonus, or commission only. Usage rights, attribution and refunds are agreed before you publish.</p><Link className="text-link link-arrow" href="/register?as=creator">Create a creator account <ArrowUpRight size={14} aria-hidden="true" /></Link></article>
      </div>
    </section>

    <section className="wrap home-section home-faq" aria-labelledby="faq-title">
      <div className="home-heading">
        <span className="eyebrow">Questions</span>
        <h2 id="faq-title">Before you start</h2>
      </div>
      <div className="faq-list">{faqs.map((item, index) => <details key={item.q} open={index === 0}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </section>

    <section className="home-cta backdrop">
      <div className="wrap home-cta-inner">
        <h2>Bring a goal.<br />Leave with a plan and a team.</h2>
        <Link className="button button-primary button-icon" href="/register">Start with a business goal <ArrowRight className="icon-slide" size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  </main>;
}
