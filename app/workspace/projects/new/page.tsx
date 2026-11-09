import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { BriefForm } from "./BriefForm";

export default async function NewProjectPage() {
  const user = await requireUser();
  const memberships = await db.organisationMembership.findMany({ where: { userId: user.id, role: { in: ["OWNER", "ADMIN", "PROJECT_MANAGER"] } }, include: { organisation: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } });
  if (!memberships.length) redirect("/workspace");
  return <main className="app-main">
    <div className="page-title-row"><div><Link className="text-link" href="/workspace/projects">← &nbsp; Project briefs</Link><h1>Start with a goal</h1><p>Describe the outcome first. You can refine scope before submitting.</p></div><span className="status-pill coral">New draft</span></div>
    <div className="project-form-layout"><BriefForm organisations={memberships.map((membership) => membership.organisation)} /><aside className="aside-card"><h3>A plan you can shape</h3><p>We’ll suggest useful workstreams from the goal you describe. The suggestions are a starting point, not a hiring decision.</p><ol><li><span>1</span>Describe the outcome, audience, and timing.</li><li><span>2</span>Review and edit suggested capabilities.</li><li><span>3</span>Choose an individual or coordinated team.</li><li><span>4</span>Submit the brief for human review.</li></ol></aside></div>
  </main>;
}
