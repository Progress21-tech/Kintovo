"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BadgeCheck, BriefcaseBusiness, Building2, CircleDollarSign,
  ClipboardCheck, FileText, FolderKanban, LayoutDashboard, Megaphone,
  MessageSquareText, Search, Settings, ShieldCheck, UserRound, UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type WorkspaceNavProps = {
  business: boolean;
  specialist: boolean;
  creator: boolean;
  operations: boolean;
  finance: boolean;
  admin: boolean;
};

type NavigationItem = { label: string; href: string; icon: LucideIcon };

export function WorkspaceNav({ business, specialist, creator, operations, finance, admin }: WorkspaceNavProps) {
  const links: NavigationItem[] = [
    { icon: LayoutDashboard, label: "Overview", href: "/workspace" },
    ...(business ? [
      { icon: FolderKanban, label: "Project briefs", href: "/workspace/projects" },
      { icon: Search, label: "Find talent", href: "/workspace/talent" },
      { icon: FileText, label: "Agreements", href: "/workspace/agreements" },
      { icon: CircleDollarSign, label: "Payments", href: "/workspace/payments" },
    ] : []),
    ...(business || creator ? [{ icon: Megaphone, label: "Campaigns", href: "/workspace/campaigns" }] : []),
    ...(specialist || creator ? [
      { icon: Activity, label: "Professional home", href: "/workspace/professional" },
      { icon: ShieldCheck, label: "Trust and evidence", href: "/workspace/profile/trust" },
      { icon: BriefcaseBusiness, label: "Opportunities", href: "/workspace/opportunities" },
      { icon: ClipboardCheck, label: "Assessments", href: "/workspace/profile/assessments" },
    ] : []),
    ...(business || specialist || creator ? [{ icon: Activity, label: "Reports", href: "/workspace/reports" }] : []),
    { icon: MessageSquareText, label: "Notifications", href: "/workspace/notifications" },
    ...(operations ? [
      { icon: LayoutDashboard, label: "Operations overview", href: "/workspace/operations" },
      { icon: FileText, label: "Brief review", href: "/workspace/operations/briefs" },
      { icon: BadgeCheck, label: "Trust review", href: "/workspace/operations/trust" },
      { icon: ClipboardCheck, label: "Assessments", href: "/workspace/operations/assessments" },
      { icon: Megaphone, label: "Campaign review", href: "/workspace/operations/campaigns" },
      { icon: UsersRound, label: "Dispute review", href: "/workspace/operations/disputes" },
    ] : []),
    ...(finance ? [{ icon: CircleDollarSign, label: "Finance operations", href: "/workspace/operations/finance" }] : []),
    ...(finance && !operations ? [{ icon: Megaphone, label: "Campaign review", href: "/workspace/operations/campaigns" }] : []),
    ...(admin ? [{ icon: Settings, label: "Platform settings", href: "/workspace/operations/settings" }] : []),
    { icon: UserRound, label: "Profile", href: "/workspace/profile" },
    { icon: Building2, label: "Organisations", href: "/workspace/organisations" },
  ];
  const pathname = usePathname();

  return <nav className="app-sidebar" aria-label="Workspace navigation">
    <span className="nav-caption">Workspace</span>
    {links.map(({ icon: Icon, label, href }) => {
      const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
      return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={href} href={href}>
        <Icon aria-hidden="true" size={16} strokeWidth={1.8} />{label}
      </Link>;
    })}
    <div className="sidebar-bottom">Kintovo <span aria-hidden="true">·</span> Nigeria first<br />Draft platform foundation</div>
  </nav>;
}
