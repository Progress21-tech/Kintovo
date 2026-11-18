import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

// One family for headings and body. Weights stop at Medium (500): titles use Regular.
const onest = Onest({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-onest" });

export const metadata: Metadata = {
  title: { default: "Kintovo — Find the people. Build the team.", template: "%s · Kintovo" },
  description: "A Nigeria-first execution network that helps businesses find African specialists and assemble teams around real goals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={onest.variable}><body>{children}</body></html>;
}
