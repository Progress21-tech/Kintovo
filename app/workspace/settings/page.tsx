import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { SettingsForms } from "./SettingsForms";

export default async function SettingsPage() {
  const user = await requireUser();
  const [memberships, complaints] = await Promise.all([
    db.organisationMembership.findMany({ where: { userId: user.id }, include: { organisation: true }, orderBy: { createdAt: "asc" } }),
    db.complaint.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const organisations = memberships.map((item) => ({ ...item.organisation, role: item.role }));
  const specialist = await db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  const context = organisations.length ? "Business" : specialist ? "Specialist" : "Creator";
  return <main className="app-main">
    <PageHeader eyebrow={`${context} workspace`} title="Settings and support" description="Manage personal contact details and business workspace information, and send a complaint to platform Operations." />
    <div className="review-list"><SettingsForms user={{ name: user.name, email: user.email, phone: user.phone }} organisations={organisations} /></div>
    <section className="review-list"><h2 className="section-subhead">Your support requests</h2>{complaints.length ? complaints.map((item) => <article className="panel" key={item.id}><div className="panel-header"><div><h2>{item.subject}</h2><span className="field-note">{item.category.replaceAll("_", " ")} · opened {item.createdAt.toLocaleString("en-NG")}</span></div><span className={`status-pill ${["RESOLVED", "CLOSED"].includes(item.status) ? "green" : "amber"}`}>{item.status.replaceAll("_", " ")}</span></div><div className="panel-content"><p>{item.description}</p>{item.staffNote && <p className="field-note"><strong>Operations update:</strong> {item.staffNote}</p>}</div></article>) : <p className="field-note">You have not submitted a support request.</p>}</section>
  </main>;
}
