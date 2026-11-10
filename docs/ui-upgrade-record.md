# Kintovo UI audit and upgrade record

Date: 10 November 2026

## Audit summary

The application already has a coherent brand token set and a broad set of operational routes. The UI is implemented with Next.js server pages, shared CSS in `app/globals.css`, a small set of shared components in `src/components`, and Lucide React. No shadcn, chart, table, or animation dependency is installed. The initial review covered the route/component inventory, workspace shell and navigation, business dashboard, talent discovery, project/brief workflows, professional profile, campaigns, agreements, payments, reports, and operations route groups.

The highest-value first improvement is the signed-in workspace overview: it is a frequent entry point, currently uses three visually generic KPI boxes, and computes those KPIs from only the six newest projects, so the figures can undercount an organisation's actual workload. The workspace nav also renders icon glyphs as mojibake. This batch improves the dashboard hierarchy, uses the existing Lucide dependency for clear icons, and counts all projects in the member's organisations while retaining the six most recently updated projects in the list.

## Prioritised improvement plan

| Priority | Area | Audit opportunity | Direction |
| --- | --- | --- | --- |
| 1 | Workspace shell and overview | Give the first signed-in screen clear hierarchy, scannable work status, responsive project rows, and a dependable nav. | Refine dashboard cards and project list; replace broken glyph icons with Lucide; preserve current routes and role gating. |
| 2 | Business discovery and project brief | Long, dense form flows need clear progress, decision context, and focused mobile layouts. | Review section order, field guidance, save/continue affordances, and editable workstream review. |
| 3 | Talent discovery and profiles | Search filters and profile cards should help users compare relevant evidence without visual noise. | Improve filter grouping, result density, trust indicators, profile summaries, and shortlist feedback. |
| 4 | Project delivery | Project workspace, tasks, milestones, submissions, and discussion need a stronger shared hierarchy. | Clarify project status, next action, milestone progression, participant context, and mobile message/task handling. |
| 5 | Proposals and agreements | Commercial decisions and immutable agreement versions need easy comparison and plain status language. | Improve terms summary, counteroffer comparison, acceptance state, and version history visibility. |
| 6 | Creator campaigns | Campaign content approval and attribution require distinguishable review states and reporting context. | Improve creator/campaign grouping, submission review, attribution explanation, and metric labels. |
| 7 | Financial operations | Ledger and reconciliation screens need readable status, totals, and audit context. | Strengthen transaction table hierarchy and separate simulated records from provider-confirmed activity. |
| 8 | Administration and trust operations | Review queues need prioritisation and enough evidence context while retaining permissions. | Improve queue scanning, evidence review, decision controls, dispute and reporting layouts. |
| 9 | Global accessibility and responsive pass | Shared patterns need consistent keyboard focus, contrast, semantic landmarks, and overflow behaviour. | Validate each upgraded flow at mobile/tablet/desktop widths and keyboard-only interaction. |

This is a prioritised implementation roadmap, not a claim that every route has already received screenshot-based visual QA. Later batches should follow the order above and keep existing server actions, authorization checks, and database behaviour intact.

## Research and component decision

- **21st.dev:** Reviewed the library and dashboard/statistics categories as the requested discovery source. The library is a discovery catalogue for React/TypeScript components; no specific external component source was copied into the project.
- **Qronos:** Reviewed the official Qronos listing and live preview. Its overview uses KPI cards, budget/activity summaries, project information, and responsive dashboard patterns. These were considered only as layout inspiration. Qronos is listed at $69, so no paid source code was accessed or used.
- **Selection:** Independently implemented a calmer operational overview with summary cards, a compact project list, and a next-step panel. It keeps Kintovo's paper/white surfaces, ink/muted text, coral/teal/amber status cues, and existing spacing scale. Lucide React was already installed, so the change adds no dependency. This is a component-level refinement and does not change the established design system.

## Batch 1 — Workspace overview

- **Screen upgraded:** `/workspace` for signed-in users who have an organisation membership.
- **Original problems:** Generic metrics lacked hierarchy and supporting context; counts only reflected the six projects loaded for the recent list; workspace context cards were plain links; nav and decorative symbols included mis-encoded glyphs; project rows had limited scan cues.
- **Selected component:** Editorial KPI cards and an operational recent-project list with icon-led context cards and a concise next-steps panel.
- **Source/licensing:** Independently implemented, informed by public 21st.dev discovery and Qronos preview patterns. No Qronos code/assets copied. No paid assets or components used.
- **New dependencies:** None. Reuses `lucide-react`.
- **Files changed:** `app/workspace/page.tsx`, `app/globals.css`, `src/components/WorkspaceNav.tsx`, this record.
- **Behaviour preserved:** Existing links, session requirements, organisation scoping, role-gated navigation, recent project ordering, and profile lookups stay in place. Aggregate KPI queries remain scoped to the user's organisation memberships. Replaced the mis-encoded nav glyphs with accessible Lucide icons; did not change route permissions.
- **Verification:** Static review completed. TypeScript check, lint, tests, production build, authenticated interaction testing, and responsive screenshot review could not be run in this environment because Node.js/npm are unavailable and browser access is unavailable. Run `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` in the configured Node environment before merging/deploying this batch.
- **Screenshots:** Not captured; no authenticated browser session was available.
- **Remaining issues:** The next UI pass should audit the business discovery form and test the dashboard with seeded accounts at mobile, tablet, and desktop sizes.
