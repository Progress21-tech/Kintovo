import Link from "next/link";

export function Brand({ href = "/", inverse = false }: { href?: string; inverse?: boolean }) {
  return <Link aria-label="Kintovo home" className={`brand${inverse ? " brand-inverse" : ""}`} href={href}>
    <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-label="Kintovo mark">
      <path d="M7 10 23 17M7 23h16M7 36l16-7M23 10l12 13-8 9" />
      <circle cx="38" cy="23" r="3.2" />
    </svg>
    <span>KINTOVO</span>
  </Link>;
}
