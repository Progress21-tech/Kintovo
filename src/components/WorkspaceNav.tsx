"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceNavProps = { business: boolean; specialist: boolean; creator: boolean; operations: boolean };

export function WorkspaceNav({ business, specialist, creator, operations }: WorkspaceNavProps) {
  const links = [
    ["◷", "Overview", "/workspace"],
    ...(business ? [["▤", "Project briefs", "/workspace/projects"], ["⌕", "Find talent", "/workspace/talent"], ["↔", "Agreements", "/workspace/agreements"], ["◉", "Payments", "/workspace/payments"]] : []),
    ...(specialist || creator ? [["✦", "Professional home", "/workspace/professional"], ["✓", "Trust and evidence", "/workspace/profile/trust"], ["◎", "Opportunities", "/workspace/opportunities"]] : []),
    ...(operations ? [["⚑", "Brief review", "/workspace/operations/briefs"], ["✓", "Trust review", "/workspace/operations/trust"]] : []),
    ["⚙", "Profile", "/workspace/profile"],
    ["♧", "Organisations", "/workspace/organisations"],
  ];
  const pathname = usePathname();
  return <aside className="app-sidebar"><span className="nav-caption">Workspace</span>{links.map(([icon, label, href]) => {
    const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
    return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={href} href={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}<div className="sidebar-bottom">Kintovo · Nigeria first<br />Draft platform foundation</div></aside>;
}
