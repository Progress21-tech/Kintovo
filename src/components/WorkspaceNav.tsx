"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceNavProps = { business: boolean; specialist: boolean; creator: boolean; operations: boolean; finance: boolean; admin: boolean };

export function WorkspaceNav({ business, specialist, creator, operations, finance, admin }: WorkspaceNavProps) {
  const links: string[][] = [
    ["◷", "Overview", "/workspace"],
    ...(business ? [["▤", "Project briefs", "/workspace/projects"], ["⌕", "Find talent", "/workspace/talent"], ["↔", "Agreements", "/workspace/agreements"], ["◉", "Payments", "/workspace/payments"]] : []),
    ...(business || creator ? [["◆", "Campaigns", "/workspace/campaigns"]] : []),
    ...(specialist || creator ? [["✦", "Professional home", "/workspace/professional"], ["✓", "Trust and evidence", "/workspace/profile/trust"], ["◎", "Opportunities", "/workspace/opportunities"], ["▧", "Assessments", "/workspace/profile/assessments"]] : []),
    ...(business || specialist || creator ? [["◫", "Reports", "/workspace/reports"]] : []),
    ["✉", "Notifications", "/workspace/notifications"],
    ...(operations ? [["⚑", "Operations overview", "/workspace/operations"], ["▤", "Brief review", "/workspace/operations/briefs"], ["✓", "Trust review", "/workspace/operations/trust"], ["▧", "Assessments", "/workspace/operations/assessments"], ["◆", "Campaign review", "/workspace/operations/campaigns"], ["⚠", "Dispute review", "/workspace/operations/disputes"]] : []),
    ...(finance ? [["◉", "Finance operations", "/workspace/operations/finance"]] : []),
    ...(finance ? [["◆", "Campaign review", "/workspace/operations/campaigns"]] : []),
    ...(admin ? [["⚙", "Platform settings", "/workspace/operations/settings"]] : []),
    ["⚙", "Profile", "/workspace/profile"],
    ["♧", "Organisations", "/workspace/organisations"],
  ];
  const pathname = usePathname();
  return <aside className="app-sidebar"><span className="nav-caption">Workspace</span>{links.map(([icon, label, href]) => {
    const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
    return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={href} href={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}<div className="sidebar-bottom">Kintovo · Nigeria first<br />Draft platform foundation</div></aside>;
}
