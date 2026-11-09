import Link from "next/link";
import { Brand } from "@/components/Brand";

export function MarketingHeader() {
  return <header className="marketing-header wrap">
    <Brand />
    <nav aria-label="Main navigation" className="marketing-nav">
      <Link href="/how-it-works">How it works</Link>
      <Link href="/for-businesses">For businesses</Link>
      <Link href="/for-professionals">For professionals</Link>
      <Link href="/for-creators">For creators</Link>
    </nav>
    <div className="header-actions"><Link className="text-link" href="/sign-in">Sign in</Link><Link className="button button-primary button-small" href="/register">Start with a goal <span aria-hidden="true">↗</span></Link></div>
  </header>;
}
