import type { Metadata } from "next";
import { ArrowRight, Bell, Briefcase, CheckCircle, MagnifyingGlass, Paperclip, ShieldCheck, Wallet } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

const colours = [
  { token: "--paper", hex: "#F7F5F0", role: "Page background" },
  { token: "--surface", hex: "#FFFFFF", role: "Cards and panels" },
  { token: "--ink", hex: "#202522", role: "Primary text; dark bands" },
  { token: "--muted", hex: "#68716C", role: "Secondary text" },
  { token: "--line", hex: "#E5E0D7", role: "Borders and dividers" },
  { token: "--accent", hex: "#E45A3D", role: "Primary actions and key emphasis only" },
  { token: "--accent-soft", hex: "#FBEAE4", role: "Accent tint, glows" },
  { token: "--teal", hex: "#2E786D", role: "Success and verified states" },
  { token: "--blue", hex: "#496F8A", role: "Information" },
  { token: "--amber", hex: "#B77A32", role: "Attention; simulated data" },
  { token: "--danger", hex: "#B7473B", role: "Errors and destructive actions" },
];

const type = [
  { label: "Page title · 28 / Regular", size: 28, weight: 400 },
  { label: "Section title · 20 / Medium", size: 20, weight: 500 },
  { label: "Body · 15 / Regular", size: 15, weight: 400 },
  { label: "Secondary · 13 / Regular", size: 13, weight: 400 },
];

export default function DesignSystemPage() {
  return <main className="wrap ds-page">
    <span className="eyebrow">Design system</span>
    <h1>The parts Kintovo is built from</h1>
    <p className="lead">Every screen takes its colours, type, spacing and radius from here. Change them here first, in <code>app/globals.css</code>, and nowhere else.</p>

    <section className="ds-section"><h2>Colour</h2><p className="field-note">One job per colour. The accent is reserved for primary actions. Status colours appear only where a state is shown.</p>
      <div className="ds-swatches">{colours.map((colour) => <div className="ds-swatch" key={colour.token}><span style={{ background: `var(${colour.token})` }} /><strong>{colour.token}</strong><small>{colour.hex} · {colour.role}</small></div>)}</div>
    </section>

    <section className="ds-section"><h2>Type</h2><p className="field-note">Onest for everything. Two weights only: Regular 400 for titles and body, Medium 500 for small headings, labels and buttons. Nothing heavier.</p>
      <div className="ds-type">{type.map((item) => <div key={item.label}><span style={{ fontSize: item.size, fontWeight: item.weight }}>Find the people. Build the team.</span><small>{item.label}</small></div>)}<div><span className="mini-label">Small label · 11 / Medium / uppercase</span></div></div>
    </section>

    <section className="ds-section"><h2>Spacing and radius</h2><p className="field-note">A 4 px grid: 4, 8, 12, 16, 24, 32, 48, 64. Radius: 3 px for chips and pills, 4–5 px for fields and buttons, 6–8 px for cards and panels.</p>
      <div className="ds-spacing">{[4, 8, 12, 16, 24, 32, 48, 64].map((size) => <div key={size}><span style={{ width: size, height: size }} /><small>{size}</small></div>)}</div>
    </section>

    <section className="ds-section"><h2>Buttons</h2><p className="field-note">The icon carries the hover interaction. No hover shadows.</p>
      <div className="inline-form"><button className="button button-primary button-icon" type="button">Primary action <ArrowRight className="icon-slide" size={16} aria-hidden="true" /></button><button className="button button-secondary" type="button">Secondary</button><button className="button button-danger" type="button">Destructive</button><button className="button button-primary button-small" type="button">Small</button><button className="button button-primary" type="button" disabled>Disabled</button></div>
    </section>

    <section className="ds-section"><h2>Fields</h2>
      <div className="form-stack ds-fields"><label>Text input<input placeholder="Placeholder text" /></label><label>Select<select defaultValue="NGN"><option>NGN</option><option>USD</option></select></label><label>Text area<textarea placeholder="Longer answer" /></label><p className="form-alert" role="alert">Error message explains what to fix.</p><p className="form-success" role="status">Success message confirms what happened.</p></div>
    </section>

    <section className="ds-section"><h2>Status</h2><p className="field-note">Simulated and sandbox data is always labelled.</p>
      <div className="inline-form"><span className="status-pill">Draft</span><span className="status-pill blue">Submitted</span><span className="status-pill amber">In review</span><span className="status-pill coral">Matching</span><span className="status-pill green">Approved</span><span className="simulated-badge">Simulated</span><span className="chip">Chip</span></div>
    </section>

    <section className="ds-section"><h2>Icons</h2><p className="field-note">Phosphor, Regular weight at 16–18 px; Fill marks the active navigation item. Rounded terminals match the 5 px button radius.</p>
      <div className="inline-form ds-icons">{[Briefcase, MagnifyingGlass, ShieldCheck, Wallet, Bell, Paperclip, CheckCircle].map((IconComponent, index) => <IconComponent key={index} size={20} aria-hidden="true" />)}</div>
    </section>
  </main>;
}
