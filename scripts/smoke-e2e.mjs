// HTTP-level journey smoke test against a running Kintovo server seeded with the
// fictional demo data (ENABLE_DEMO_SEED=1 npm run db:seed).
//   BASE_URL=http://localhost:3000 node scripts/smoke-e2e.mjs
// It signs in through the real Auth.js credentials flow for each role, loads that
// role's pages, and checks that pages belonging to other roles are refused.
// It is not a browser test: client-side interactions are not exercised.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "Kintovo-demo-only!2026";
let failures = 0;

class Session {
  cookies = new Map();
  store(response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1));
    }
  }
  header() { return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "); }
  async fetch(path, init = {}) {
    const response = await fetch(new URL(path, BASE), { ...init, redirect: "manual", headers: { ...(init.headers ?? {}), cookie: this.header() } });
    this.store(response);
    return response;
  }
  async signIn(email) {
    const csrf = await (await this.fetch("/api/auth/csrf")).json();
    const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: PASSWORD, callbackUrl: `${BASE}/workspace` });
    await this.fetch("/api/auth/callback/credentials", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    const session = await (await this.fetch("/api/auth/session")).json();
    if (!session?.user) throw new Error(`Sign-in failed for ${email}`);
  }
}

function check(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function expectPage(session, path, text) {
  const response = await session.fetch(path);
  const html = response.status === 200 ? await response.text() : "";
  check(`${path} renders${text ? ` “${text}”` : ""}`, response.status === 200 && (!text || html.includes(text)), `status ${response.status}${response.headers.get("location") ? ` → ${response.headers.get("location")}` : ""}`);
}

async function expectRefused(session, path) {
  const response = await session.fetch(path);
  const location = response.headers.get("location") ?? "";
  const refused = response.status === 404 || response.status === 403 || (response.status >= 300 && response.status < 400 && !location.endsWith(path)) || (response.status === 200 && (await response.text()).includes("NEXT_REDIRECT"));
  check(`${path} is refused`, refused, `status ${response.status} ${location}`);
}

const anonymous = new Session();
for (const path of ["/", "/about", "/contact", "/privacy", "/terms", "/sign-in", "/register"]) await expectPage(anonymous, path);
// Audience pages are sections of the home page and redirect to its anchors by design.
for (const path of ["/how-it-works", "/for-businesses", "/for-professionals", "/for-creators"]) {
  const response = await anonymous.fetch(path);
  check(`${path} redirects to a home-page section`, response.status >= 300 && response.status < 400 && (response.headers.get("location") ?? "").includes("/#"), `status ${response.status}`);
}
check("/api/health responds", (await anonymous.fetch("/api/health")).status === 200);
await expectRefused(anonymous, "/workspace");
check("anonymous file download is refused", (await anonymous.fetch("/api/files/does-not-exist")).status === 401);

const journeys = [
  { email: "buyer@example.test", pages: [["/workspace/projects", "Nigeria student launch"], ["/workspace/projects/seed-project-active", "Launch video set"], ["/workspace/projects/seed-project-hire", "Latest offer"], ["/workspace/talent", "Ada Example"], ["/workspace/talent?compare=", "Find a specialist"], ["/workspace/campaigns", "Exam-season study tips"], ["/workspace/reports"], ["/workspace/payments"], ["/workspace/settings", "Notification preferences"], ["/workspace/notifications", "Milestone submitted"]], refused: ["/workspace/admin", "/workspace/operations/disputes", "/workspace/admin/audit"] },
  { email: "pm@example.test", pages: [["/workspace/projects/seed-project-active", "Nigeria student launch"]], refused: ["/workspace/admin"] },
  { email: "specialist@example.test", pages: [["/workspace/professional"], ["/workspace/profile", "Portfolio"], ["/workspace/profile/trust", "Appeals and corrections"], ["/workspace/projects/seed-project-active", "Launch video set"], ["/workspace/earnings"], ["/workspace/opportunities"]], refused: ["/workspace/talent", "/workspace/operations/trust", "/workspace/projects/seed-project-submitted"] },
  { email: "creator@example.test", pages: [["/workspace/campaigns", "seed-tunde-exam"]], refused: ["/workspace/admin/webhooks"] },
  { email: "ops@example.test", pages: [["/workspace/operations"], ["/workspace/operations/briefs", "Campus ambassador"], ["/workspace/operations/trust", "Appeals and correction requests"], ["/workspace/operations/disputes", "Communication"], ["/workspace/operations/assessments"]], refused: ["/workspace/admin/audit"] },
  { email: "finance@example.test", pages: [["/workspace/operations/finance"], ["/workspace/admin/webhooks", "Busha"]], refused: ["/workspace/admin/audit", "/workspace/operations/trust"] },
  { email: "admin@example.test", pages: [["/workspace/admin"], ["/workspace/admin/users"], ["/workspace/admin/audit", "DEMO_SEED_LOADED"], ["/workspace/admin/webhooks", "Webhooks and providers"], ["/workspace/operations/settings"]], refused: [] },
];
for (const journey of journeys) {
  console.log(`\n— ${journey.email}`);
  const session = new Session();
  try { await session.signIn(journey.email); check("signs in", true); } catch (error) { check("signs in", false, error.message); continue; }
  for (const [path, text] of journey.pages) await expectPage(session, path, text);
  for (const path of journey.refused) await expectRefused(session, path);
}
const campaignReport = new Session();
await campaignReport.signIn("buyer@example.test");
const campaigns = await (await campaignReport.fetch("/workspace/campaigns")).text();
const reportPath = campaigns.match(/\/workspace\/campaigns\/[a-z0-9]+\/report/)?.[0];
check("campaign report link present", Boolean(reportPath));
if (reportPath) await expectPage(campaignReport, reportPath, "test or manually entered events");

console.log(`\n${failures ? `${failures} check(s) failed` : "All smoke checks passed"}`);
process.exit(failures ? 1 : 0);
