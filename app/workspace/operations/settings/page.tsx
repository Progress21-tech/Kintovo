import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { updatePlatformSetting } from "../actions";

const flags = [
  { key: "NEW_PROJECTS_ENABLED", label: "New project briefs", description: "Allow authorised business users to create project briefs." },
  { key: "CAMPAIGNS_ENABLED", label: "Creator campaigns", description: "Allow campaign creation and invitations." },
  { key: "MANUAL_ATTRIBUTION_ENABLED", label: "Manual test attribution", description: "Allow creators to enter conversion claims for human review." },
] as const;

export default async function PlatformSettingsPage() {
  const user = await requireUser();
  if (user.platformRole !== "ADMIN") redirect("/workspace");
  const settings = await db.platformSetting.findMany({ where: { key: { in: flags.map((item) => item.key) } } });
  return <main className="app-main"><PageHeader eyebrow="Operations · Administration" title="Platform settings" description="Operational feature switches. Secrets, payment credentials, and private storage configuration remain environment-managed." />
    <div className="review-list">{flags.map((flag) => { const setting = settings.find((item) => item.key === flag.key); const enabled = typeof setting?.value === "boolean" ? setting.value : true; return <article className="panel" key={flag.key}><div className="panel-content"><div className="offer-heading"><div><h2>{flag.label}</h2><p className="field-note">{flag.description}</p></div><span className={`status-pill ${enabled ? "green" : "amber"}`}>{enabled ? "Enabled" : "Paused"}</span></div><form action={updatePlatformSetting} className="inline-form"><input type="hidden" name="key" value={flag.key} /><button className="button button-secondary button-small" name="enabled" value={String(!enabled)}>{enabled ? "Pause feature" : "Enable feature"}</button></form></div></article>; })}</div>
    <p className="legal-note">Changes are audit-logged. Turning off a feature does not delete existing records. Campaign and payment settings do not enable live provider integrations.</p>
  </main>;
}
