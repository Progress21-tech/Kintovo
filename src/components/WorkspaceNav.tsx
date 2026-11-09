"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["◷", "Overview", "/workspace"],
  ["▤", "Project briefs", "/workspace/projects"],
  ["⌕", "Find talent", "/workspace/talent"],
  ["↔", "Agreements", "/workspace/agreements"],
  ["◉", "Payments", "/workspace/payments"],
  ["⚙", "Settings", "/workspace/profile"],
];

export function WorkspaceNav() {
  const pathname = usePathname();
  return <aside className="app-sidebar"><span className="nav-caption">Workspace</span>{links.map(([icon, label, href]) => {
    const active = href === "/workspace" ? pathname === href : pathname.startsWith(href);
    return <Link aria-current={active ? "page" : undefined} className={`side-link${active ? " active" : ""}`} key={href} href={href}><span aria-hidden="true">{icon}</span>{label}</Link>;
  })}<div className="sidebar-bottom">Kintovo · Nigeria first<br />Draft platform foundation</div></aside>;
}
