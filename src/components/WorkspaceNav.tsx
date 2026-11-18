"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, Briefcase, Buildings, ChartLineUp, ClipboardText, FileText, GearSix, Kanban, List, ListMagnifyingGlass,
  MagnifyingGlass, Megaphone, Pulse, Scales, SealCheck, ShieldCheck, SidebarSimple, SquaresFour, User, UsersThree, Wallet, X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

type WorkspaceNavProps = {
  business: boolean;
  businessFunding: boolean;
  specialist: boolean;
  creator: boolean;
  operations: boolean;
  finance: boolean;
  admin: boolean;
};

type NavigationItem = { label: string; href: string; icon: Icon };
type NavigationGroup = { caption: string; items: NavigationItem[] };

export function WorkspaceNav({ business, businessFunding, specialist, creator, operations, finance, admin }: WorkspaceNavProps) {
  const talent = specialist || creator;
  const groups: NavigationGroup[] = [
    { caption: "Workspace", items: [
      { icon: SquaresFour, label: "Overview", href: "/workspace" },
      { icon: Bell, label: "Notifications", href: "/workspace/notifications" },
      ...(business || talent ? [{ icon: ChartLineUp, label: "Reports", href: "/workspace/reports" }] : []),
    ] },
    { caption: "Business", items: business ? [
      { icon: Kanban, label: "Project briefs", href: "/workspace/projects" },
      { icon: MagnifyingGlass, label: "Find talent", href: "/workspace/talent" },
      { icon: FileText, label: "Agreements", href: "/workspace/agreements" },
      { icon: Megaphone, label: "Campaigns", href: "/workspace/campaigns" },
      { icon: Wallet, label: "Payments", href: "/workspace/payments" },
      ...(businessFunding ? [{ icon: Wallet, label: "Add funds", href: "/workspace/funding" }] : []),
    ] : [] },
    { caption: creator && !specialist ? "Creator" : "Professional", items: talent ? [
      { icon: Pulse, label: "Professional home", href: "/workspace/professional" },
      { icon: Briefcase, label: "Opportunities", href: "/workspace/opportunities" },
      ...(creator && !business ? [{ icon: Megaphone, label: "Campaigns", href: "/workspace/campaigns" }] : []),
      { icon: Wallet, label: "Wallet & payouts", href: "/workspace/earnings" },
      { icon: User, label: "Profile", href: "/workspace/profile" },
      { icon: ShieldCheck, label: "Trust and evidence", href: "/workspace/profile/trust" },
      { icon: ClipboardText, label: "Assessments", href: "/workspace/profile/assessments" },
    ] : [] },
    { caption: "Operations", items: operations ? [
      { icon: SquaresFour, label: "Operations overview", href: "/workspace/operations" },
      { icon: FileText, label: "Brief review", href: "/workspace/operations/briefs" },
      { icon: SealCheck, label: "Trust review", href: "/workspace/operations/trust" },
      { icon: ClipboardText, label: "Assessment review", href: "/workspace/operations/assessments" },
      { icon: Megaphone, label: "Campaign review", href: "/workspace/operations/campaigns" },
      { icon: Scales, label: "Dispute review", href: "/workspace/operations/disputes" },
      { icon: Bell, label: "Support complaints", href: "/workspace/operations/complaints" },
    ] : [] },
    { caption: "Finance", items: finance ? [
      { icon: Wallet, label: "Finance operations", href: "/workspace/operations/finance" },
      ...(!operations ? [{ icon: Megaphone, label: "Campaign review", href: "/workspace/operations/campaigns" }] : []),
      ...(!admin ? [{ icon: Pulse, label: "Webhooks and providers", href: "/workspace/admin/webhooks" }] : []),
    ] : [] },
    { caption: "Administration", items: admin ? [
      { icon: GearSix, label: "Admin console", href: "/workspace/admin" },
      { icon: UsersThree, label: "People and accounts", href: "/workspace/admin/users" },
      { icon: ListMagnifyingGlass, label: "Audit log", href: "/workspace/admin/audit" },
      { icon: Pulse, label: "Webhooks and providers", href: "/workspace/admin/webhooks" },
      { icon: GearSix, label: "Platform settings", href: "/workspace/operations/settings" },
    ] : [] },
    { caption: "Account", items: [
      { icon: Buildings, label: "Organisations", href: "/workspace/organisations" },
      { icon: GearSix, label: "Settings and support", href: "/workspace/settings" },
    ] },
  ].filter((group) => group.items.length > 0);
  const allHrefs = groups.flatMap((group) => group.items.map((item) => item.href));
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // The most specific matching link is active, so /workspace/profile/trust does not also light up Profile.
  const activeHref = allHrefs.filter((href) => href === "/workspace" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)).sort((a, b) => b.length - a.length)[0];

  return <>
    <button className="mobile-nav-toggle" type="button" aria-label="Open workspace navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><List size={18} aria-hidden="true" /><span>Menu</span></button>
    <aside className={`app-sidebar-shell${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
    <nav className="app-sidebar" aria-label="Workspace navigation">
      <div className="sidebar-heading"><span className="nav-caption" aria-hidden="true" /><div className="sidebar-heading-actions"><button className="sidebar-toggle" type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><SidebarSimple size={16} aria-hidden="true" /></button><button className="sidebar-close-mobile" type="button" aria-label="Close workspace navigation" onClick={() => setMobileOpen(false)}><X size={16} aria-hidden="true" /></button></div></div>
      {groups.map((group) => <div className="side-group" key={group.caption} role="group" aria-label={group.caption}>
        <span className="nav-caption side-group-caption">{group.caption}</span>
        {group.items.map(({ icon: ItemIcon, label, href }) => {
          const active = href === activeHref;
          return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={`${group.caption}-${href}`} href={href} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>
            <ItemIcon className="side-link-icon" aria-hidden="true" size={17} weight={active ? "fill" : "regular"} /><span>{label}</span>
          </Link>;
        })}
      </div>)}
      <div className="sidebar-bottom">Kintovo <span aria-hidden="true">·</span> Nigeria first</div>
    </nav>
    </aside>
  </>;
}
