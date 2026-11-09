import { signOut } from "@/auth";
import { Brand } from "@/components/Brand";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { requireUser } from "@/server/access";
import { db } from "@/server/db";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const [membership, specialist, creator] = await Promise.all([
    db.organisationMembership.findFirst({ where: { userId: user.id }, include: { organisation: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.professionalProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.creatorProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);
  return <div className="workspace">
    <header className="app-topbar"><div className="app-top-left"><Brand /><span className="org-label">{membership?.organisation.name ?? "Professional workspace"}</span></div><div className="app-top-right"><span className="app-user">{user.name}</span><form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="signout-button">Sign out</button></form></div></header>
    <div className="app-frame"><WorkspaceNav business={!!membership} specialist={!!specialist} creator={!!creator} operations={user.platformRole === "ADMIN" || user.platformRole === "OPERATIONS"} finance={user.platformRole === "ADMIN" || user.platformRole === "FINANCE"} admin={user.platformRole === "ADMIN"} /><div>{children}</div></div>
  </div>;
}
