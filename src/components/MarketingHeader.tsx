import Link from "next/link";
import { ArrowRight, List } from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/Brand";

const links = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#businesses", label: "For businesses" },
  { href: "/#professionals", label: "For professionals" },
  { href: "/#creators", label: "For creators" },
];

export function MarketingHeader() {
  return <div className="marketing-header-shell">
    <header className="marketing-header wrap">
      <Brand />
      <nav aria-label="Main navigation" className="marketing-nav">{links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
      <div className="header-actions">
        <Link className="text-link" href="/sign-in">Sign in</Link>
        <Link className="button button-primary button-small button-icon header-cta" href="/register">Start with a goal <ArrowRight className="icon-slide" size={14} aria-hidden="true" /></Link>
        <details className="mobile-menu">
          <summary aria-label="Open menu"><List size={20} aria-hidden="true" /></summary>
          <nav aria-label="Mobile navigation">{links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}<Link href="/about">About</Link><Link href="/register">Start with a goal</Link></nav>
        </details>
      </div>
    </header>
  </div>;
}
