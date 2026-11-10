import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";
import { updateAccountAccess } from "../actions";

type Search = { q?: string; state?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const actor = await requireUser();
  if (actor.platformRole !== "ADMIN") redirect("/workspace");
  const query = await searchParams;
  const needle = query.q?.trim();
  const state = ["active", "suspended", "banned"].includes(query.state ?? "") ? query.state : "";
  const users = await db.user.findMany({
    where: {
      ...(needle ? { OR: [{ name: { contains: needle, mode: "insensitive" as const } }, { email: { contains: needle, mode: "insensitive" as const } }] } : {}),
      ...(state === "active" ? { disabledAt: null, bannedAt: null } : {}),
      ...(state === "suspended" ? { disabledAt: { not: null }, bannedAt: null } : {}),
      ...(state === "banned" ? { bannedAt: { not: null } } : {}),
    },
    include: {
      memberships: { include: { organisation: { select: { name: true } } } },
      specialist: { select: { onboardingCompletedAt: true, isPublished: true, verificationStatus: true, expertiseLevel: true } },
      creator: { select: { onboardingCompletedAt: true, isPublished: true, verificationStatus: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  const [paidByRecipient, paidByPayer, reviewStats, campaignReviewStats] = await Promise.all([db.compensationObligation.groupBy({
    by: ["recipientId", "currency"],
    where: { status: { in: ["SIMULATED_PAID", "PROVIDER_CONFIRMED_PAID"] }, recipientId: { not: null } },
    _sum: { amount: true },
  }), db.compensationObligation.groupBy({
    by: ["createdById", "currency"],
    where: { status: { in: ["SIMULATED_PAID", "PROVIDER_CONFIRMED_PAID"] }, createdById: { not: null } },
    _sum: { amount: true },
  }), db.engagementRating.groupBy({ by: ["revieweeId"], _avg: { rating: true }, _count: { _all: true } }), db.campaignRating.groupBy({ by: ["revieweeId"], _avg: { rating: true }, _count: { _all: true } })]);
  const recipientTotals = new Map<string, string[]>();
  for (const item of paidByRecipient) {
    if (!item.recipientId) continue;
    const lines = recipientTotals.get(item.recipientId) ?? [];
    lines.push(`${item.currency} ${(item._sum.amount ?? 0).toLocaleString("en-NG")}`);
    recipientTotals.set(item.recipientId, lines);
  }
  const payerTotals = new Map<string, string[]>();
  for (const item of paidByPayer) {
    if (!item.createdById) continue;
    const lines = payerTotals.get(item.createdById) ?? [];
    lines.push(`${item.currency} ${(item._sum.amount ?? 0).toLocaleString("en-NG")}`);
    payerTotals.set(item.createdById, lines);
  }
  const reputation = new Map<string, string>();
  const combinedReviews = new Map<string, { sum: number; count: number }>();
  for (const item of [...reviewStats, ...campaignReviewStats]) {
    const current = combinedReviews.get(item.revieweeId) ?? { sum: 0, count: 0 };
    current.sum += (item._avg.rating ?? 0) * item._count._all;
    current.count += item._count._all;
    combinedReviews.set(item.revieweeId, current);
  }
  for (const [id, item] of combinedReviews) reputation.set(id, `${(item.sum / item.count).toFixed(1)}/5 · ${item.count} review${item.count === 1 ? "" : "s"}`);
  return <main className="app-main">
    <PageHeader eyebrow="Administration" title="People and accounts" description="Review account setup, profile approval, recent activity, and recorded compensation by recipient. Compensation totals distinguish simulated records from provider-confirmed payments." />
    <form className="panel talent-search-form" method="get">
      <label>Search name or email<input name="q" defaultValue={needle} /></label>
      <label>Access state<select name="state" defaultValue={state}><option value="">All accounts</option><option value="active">Enabled</option><option value="suspended">Temporarily suspended</option><option value="banned">Permanently banned</option></select></label>
      <button className="button button-primary">Filter accounts</button>
    </form>
    <section className="review-list admin-users-list">
      <h2 className="section-subhead">Accounts ({users.length}{users.length === 150 ? "+ shown" : ""})</h2>
      {users.length ? users.map((person) => {
        const status = person.bannedAt ? "Permanently banned" : person.disabledAt ? "Temporarily suspended" : "Enabled";
        const contexts = [
          ...person.memberships.map((membership) => `Business · ${membership.organisation.name} (${membership.role.toLowerCase().replaceAll("_", " ")})`),
          person.specialist ? `Specialist ${person.specialist.expertiseLevel.replaceAll("_", " ")} · ${person.specialist.isPublished ? "approved and published" : person.specialist.onboardingCompletedAt ? "submitted for review" : "profile incomplete"}` : "",
          person.creator ? `Creator · ${person.creator.isPublished ? "approved and published" : person.creator.onboardingCompletedAt ? "submitted for review" : "profile incomplete"}` : "",
        ].filter(Boolean);
        return <article className="panel review-card" key={person.id}>
          <div className="panel-header"><div><h2>{person.name}</h2><span className="field-note">{person.email} · joined {person.createdAt.toLocaleDateString("en-NG")}</span></div><span className={`status-pill ${person.bannedAt ? "amber" : person.disabledAt ? "amber" : "green"}`}>{status}</span></div>
          <div className="panel-content">
            <p className="field-note">{contexts.length ? contexts.join(" · ") : "No completed business or talent profile"}</p>
            <p className="field-note">Last active: {person.lastActiveAt?.toLocaleString("en-NG") ?? "No tracked workspace activity"} · Email: {person.emailVerifiedAt ? "verified" : "unverified"}</p>
            <p className="field-note">Received compensation: {recipientTotals.get(person.id)?.join(" · ") ?? "None"} {recipientTotals.has(person.id) ? "(includes simulated settlement records)" : ""}</p>
            <p className="field-note">Obligations initiated: {payerTotals.get(person.id)?.join(" · ") ?? "None"} {payerTotals.has(person.id) ? "(includes simulated settlement records)" : ""}</p>
            <p className="field-note">Project reputation: {reputation.get(person.id) ?? "No completed-project ratings"}</p>
            {person.banReason && <p className="legal-note">Ban reason: {person.banReason}</p>}
            {person.id !== actor.id && !person.bannedAt && <div className="admin-account-actions">
              {person.disabledAt ? <form action={updateAccountAccess} className="inline-form"><input type="hidden" name="userId" value={person.id} /><input type="hidden" name="action" value="RESTORE" /><label>Reason for restoring access<input name="reason" minLength={8} maxLength={1000} required /></label><button className="button button-secondary button-small">Restore access</button></form> : <form action={updateAccountAccess} className="inline-form"><input type="hidden" name="userId" value={person.id} /><input type="hidden" name="action" value="SUSPEND" /><label>Reason for temporary suspension<input name="reason" minLength={8} maxLength={1000} required /></label><button className="button button-secondary button-small">Suspend temporarily</button></form>}
              <details className="workflow-details"><summary>Ban this account permanently</summary><form action={updateAccountAccess} className="form-stack"><input type="hidden" name="userId" value={person.id} /><input type="hidden" name="action" value="BAN" /><label>Reason<textarea name="reason" minLength={8} maxLength={1000} required /></label><p className="field-note">This permanently blocks this account from signing in. The account and audit records are retained; this action does not delete personal data or block access from other IP addresses.</p><button className="button button-secondary button-small">Permanently ban account</button></form></details>
            </div>}
          </div>
        </article>;
      }) : <p className="field-note">No accounts match these filters.</p>}
    </section>
  </main>;
}
