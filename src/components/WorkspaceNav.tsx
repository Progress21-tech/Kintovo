"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, BadgeCheck, BriefcaseBusiness, Building2, CircleDollarSign,
  ClipboardCheck, FileText, FolderKanban, LayoutDashboard, Megaphone,
  Menu, MessageSquareText, PanelLeftClose, PanelLeftOpen, Search, Settings, ShieldCheck, UserRound, UsersRound, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type WorkspaceNavProps = {
  business: boolean;
  businessFunding: boolean;
  specialist: boolean;
  creator: boolean;
  operations: boolean;
  finance: boolean;
  admin: boolean;
};

type NavigationItem = { label: string; href: string; icon: LucideIcon };

export function WorkspaceNav({ business, businessFunding, specialist, creator, operations, finance, admin }: WorkspaceNavProps) {
  const links: NavigationItem[] = [
    { icon: LayoutDashboard, label: "Overview", href: "/workspace" },
    ...(business ? [
      { icon: FolderKanban, label: "Project briefs", href: "/workspace/projects" },
      { icon: Search, label: "Find talent", href: "/workspace/talent" },
      { icon: FileText, label: "Agreements", href: "/workspace/agreements" },
      { icon: CircleDollarSign, label: "Payments", href: "/workspace/payments" },
      ...(businessFunding ? [{ icon: CircleDollarSign, label: "Add funds", href: "/workspace/funding" }] : []),
    ] : []),
    ...(business || creator ? [{ icon: Megaphone, label: "Campaigns", href: "/workspace/campaigns" }] : []),
    ...(specialist || creator ? [
      { icon: Activity, label: "Professional home", href: "/workspace/professional" },
      { icon: CircleDollarSign, label: "Earnings", href: "/workspace/earnings" },
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
    ...(admin ? [{ icon: Settings, label: "Admin console", href: "/workspace/admin" }, { icon: UsersRound, label: "People and accounts", href: "/workspace/admin/users" }, { icon: Settings, label: "Platform settings", href: "/workspace/operations/settings" }] : []),
    ...(specialist || creator ? [{ icon: UserRound, label: "Profile", href: "/workspace/profile" }] : []),
    { icon: Building2, label: "Organisations", href: "/workspace/organisations" },
  ];
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return <>
    <button className="mobile-nav-toggle" type="button" aria-label="Open workspace navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={18} aria-hidden="true" /><span>Menu</span></button>
    <aside className={`app-sidebar-shell${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
    <nav className="app-sidebar" aria-label="Workspace navigation">
      <div className="sidebar-heading"><span className="nav-caption">Workspace</span><div className="sidebar-heading-actions"><button className="sidebar-toggle" type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}</button><button className="sidebar-close-mobile" type="button" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)}><X size={16} aria-hidden="true" /></button></div></div>
      {links.map(({ icon: Icon, label, href }) => {
        const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
        return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={href} href={href} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
          <Icon className="side-link-icon" aria-hidden="true" size={16} strokeWidth={1.8} /><span>{label}</span>
        </Link>;
      })}
      <div className="sidebar-bottom">Kintovo <span aria-hidden="true">·</span> Nigeria first<br />Draft platform foundation</div>
    </nav>
    </aside>
  </>;
}
