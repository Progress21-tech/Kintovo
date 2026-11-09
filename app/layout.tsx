import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kintovo — Find the people. Build the team.", template: "%s · Kintovo" },
  description: "A Nigeria-first execution network that helps businesses find African specialists and assemble teams around real goals.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
