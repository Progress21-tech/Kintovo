import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

function ReviewStatus({ status, completedAt }: { status: string; completedAt: Date | null }) {
  const label = completedAt ? status.replaceAll("_", " ") : "Draft not submitted";
  const tone = status === "VERIFIED" ? "green" : status === "IN_REVIEW" ? "blue" : status === "REJECTED" ? "amber" : "";
  return <span className={`status-pill ${tone}`}>{label}</span>;
}

export default async function ProfessionalHomePage() {
  const user = await requireUser();
  const [specialist, creator] = await Promise.all([
    db.professionalProfile.findUnique({ where: { userId: user.id }, include: { portfolio: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id } }),
  ]);
  return <main className="app-main">
    <PageHeader eyebrow="Professional workspace" title={`Your work on Kintovo, ${user.name.split(" ")[0]}`} description="Manage your role-specific professional profile. Kintovo keeps it private until an authorised review and publication." />
    {!specialist && !creator && <div className="panel empty-state"><div><span className="empty-icon">✦</span><h3>Choose your professional role</h3><p>Select the role that matches the work you want to do. Your account will remain in that role.</p><div className="empty-actions"><Link className="button button-primary" href="/workspace/profile?context=SPECIALIST">Start specialist profile</Link><Link className="button button-secondary" href="/workspace/profile?context=CREATOR">Start creator profile</Link></div></div></div>}
    <div className="professional-grid">
      {specialist && <Panel title="Specialist profile" action={<ReviewStatus status={specialist.verificationStatus} completedAt={specialist.onboardingCompletedAt} />}>
        <div className="panel-content professional-summary"><h3>{specialist.headline || "Add a professional headline"}</h3><p>{specialist.biography || "Add a short description of your experience and the work you want to do."}</p><div className="talent-tags">{specialist.categories.map((item) => <span className="chip" key={item}>{item}</span>)}</div><dl><div><dt>Experience</dt><dd>{specialist.yearsExperience === null ? "Not added" : `${specialist.yearsExperience} years`}</dd></div><div><dt>Portfolio items</dt><dd>{specialist.portfolio.length}</dd></div><div><dt>Availability</dt><dd>{specialist.availability || "Not set"}</dd></div></dl><Link className="button button-secondary button-small" href="/workspace/profile?context=SPECIALIST">Edit specialist profile</Link></div>
      </Panel>}
      {creator && <Panel title="Creator profile" action={<ReviewStatus status={creator.verificationStatus} completedAt={creator.onboardingCompletedAt} />}>
        <div className="panel-content professional-summary"><h3>Creator and content production</h3><p>{creator.biography || "Add a short description of the content you make."}</p><div className="talent-tags">{creator.contentCategories.map((item) => <span className="chip" key={item}>{item}</span>)}</div><dl><div><dt>Channels</dt><dd>{creator.platforms.length || "Not added"}</dd></div><div><dt>Audience size</dt><dd>{creator.audienceSize?.toLocaleString("en-NG") ?? "Optional"}</dd></div><div><dt>Audience geography</dt><dd>{creator.audienceGeography || "Not added"}</dd></div></dl><Link className="button button-secondary button-small" href="/workspace/profile?context=CREATOR">Edit creator profile</Link></div>
      </Panel>}
    </div>
    <p className="field-note professional-note">Profile intake, opportunity invitations, evidence review, and creator campaign workflows are available from the workspace navigation. Publication and verification remain subject to human review.</p>
  </main>;
}
