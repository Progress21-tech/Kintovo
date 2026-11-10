import Link from "next/link";
import { Brand } from "@/components/Brand";

export function SiteFooter() {
  return <footer className="site-footer wrap">
    <Brand />
    <span>Nigeria first · African talent · Global and regional businesses</span>
    <nav className="footer-links" aria-label="Footer"><Link href="/#businesses">Businesses</Link><Link href="/#professionals">Professionals</Link><Link href="/#creators">Creators</Link><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
  </footer>;
}
