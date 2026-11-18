import Link from "next/link";
import { Brand } from "@/components/Brand";

const columns = [
  { title: "Product", links: [["/#how-it-works", "How it works"], ["/register", "Start with a goal"], ["/sign-in", "Sign in"]] },
  { title: "Join", links: [["/#businesses", "Businesses"], ["/#professionals", "Professionals"], ["/#creators", "Creators"]] },
  { title: "Company", links: [["/about", "About"], ["/contact", "Contact and support"]] },
  { title: "Legal", links: [["/terms", "Terms of service"], ["/privacy", "Privacy notice"]] },
] as const;

function currentYear() { return new Date().getFullYear(); }

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="wrap site-footer-inner">
      <div className="footer-brand"><Brand /><p>Curated African specialists and creators, organised around business goals. Nigeria first.</p></div>
      {columns.map((column) => <nav key={column.title} className="footer-column" aria-label={column.title}><span className="mini-label">{column.title}</span>{column.links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>)}
    </div>
    <div className="wrap footer-base"><span>© {currentYear()} Kintovo. Terms and privacy notice are drafts pending legal review.</span></div>
  </footer>;
}
