import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "How it works" };
const steps = [
  ["01", "Describe the goal", "Tell Kintovo what you want to accomplish, who you want to reach, and when you need the work."],
  ["02", "Map the work", "Review proposed capabilities and workstreams. Suggestions are editable and do not make hiring decisions for you."],
  ["03", "Choose your engagement", "Hire one specialist for a defined need or request a coordinated team when the goal requires several skills."],
  ["04", "Agree and deliver", "Document the scope, deadlines, compensation, and review terms before work begins. Track submissions and decisions."],
];
export default function HowItWorksPage() { return <main className="wrap prose-page"><span className="eyebrow">The Kintovo workflow</span><h1>From business objective to coordinated execution.</h1><p className="lead">Start with the outcome you want. Build a plan with the right local capabilities, then work through a clear engagement.</p>{steps.map(([number,title,body])=><section key={number}><h2>{number} &nbsp; {title}</h2><p>{body}</p></section>)}<p className="legal-note">Payment flows shown in planning materials are targets. Live marketplace fund holding and conditional release are not currently available.</p><Link className="button button-primary" href="/register">Start with a goal</Link></main>; }
