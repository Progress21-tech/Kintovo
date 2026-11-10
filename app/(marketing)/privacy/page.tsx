export default function PrivacyPage() {
  return <main className="wrap prose-page">
    <span className="eyebrow">Draft · version 2026-11-10</span>
    <h1>Privacy Notice</h1>
    <p className="lead">This draft describes personal information used by the current Kintovo product. It must be completed and reviewed by qualified privacy counsel before public production use.</p>
    <div className="legal-note">Draft for legal review · The controller's legal identity, contact address, hosting locations, subprocessors, retention schedule, and user-rights process must be confirmed before launch.</div>
    <h2>1. Information used</h2>
    <ul>
      <li><strong>Account and contact information:</strong> name, email, optional phone number, email-verification state, sign-in and policy-acceptance records.</li>
      <li><strong>Workspace information:</strong> organisation name and business details, membership roles, project goals, briefs, proposals, agreements, messages, tasks, submissions, disputes, and completion records.</li>
      <li><strong>Professional and Creator information:</strong> profile descriptions, categories, skills, experience, indicative rates, portfolio and evidence links, audience information, assessment results, profile-review decisions, and publication status.</li>
      <li><strong>Trust and service records:</strong> complaints and Operations responses, project and campaign ratings, campaign participation and content, tracked referral clicks, manually submitted conversion claims, compensation obligations, ledger entries, and withdrawal-review records.</li>
      <li><strong>Security and activity data:</strong> workspace activity timestamps and short-lived rate-limit records. Sign-in and registration controls derive hashed keys from supplied email/IP values; the application stores the digest in the rate-limit table rather than the raw email or IP. Expired keys are periodically removed.</li>
    </ul>
    <h2>2. Why the information is used</h2>
    <p>The product uses this information to create and secure accounts, provide role-scoped workspaces, review and publish profiles and project goals, support project and campaign delivery, record ratings and complaints, calculate campaign bonuses, show compensation history, review withdrawal requests, prevent abuse, maintain operational audit history, and produce reports.</p>
    <h2>3. Sharing and visibility</h2>
    <p>Business details and project information are available to authorised members of the relevant organisation and, after the applicable human review, to relevant participants. Published Specialist profiles may be shown in business talent discovery. Published Creator profiles may be shown to campaign managers. Project counterparties can see information needed to negotiate and perform their work. Ratings may be displayed as reputation summaries. Operations reviewers and authorised administrators can access records needed for their duties.</p>
    <p>Profile publication and evidence review do not mean every submitted detail is independently verified. Private identity-document storage is not enabled. Campaign conversion data entered manually is not provider-verified. Compensation and settlement records are simulated in this installation.</p>
    <h2>4. Retention, restrictions, and deletion</h2>
    <p>Project, review, complaint, rating, financial, security, and audit records may be retained to operate the service, investigate reports, prevent abuse, and preserve transaction history. The exact retention periods, deletion criteria, backup lifecycle, legal basis, and handling of data-subject requests have not yet been established. Permanently banned accounts are currently retained with their audit history. Automatic account deletion and IP blacklisting are not implemented.</p>
    <h2>5. Providers, transfers, and security</h2>
    <p>Email delivery and hosting providers and their processing locations must be documented for the production deployment. Optional AI profile or project-planning requests use selected details only after explicit in-product consent. Live payment processing is not enabled. The production security controls, incident process, data-transfer safeguards, and backup arrangements need review and confirmation.</p>
    <h2>6. Your choices and requests</h2>
    <p>You can edit your name and phone number and submit a complaint to Operations from Settings and Support. Email changes require a separate verified workflow. Access, correction, deletion, objection, portability, retention, and appeal processes need to be confirmed with the product operator and qualified counsel. The responsible privacy contact and contact address are not yet configured.</p>
    <h2>7. Updates and acceptance</h2>
    <p>This notice has version 2026-11-10. Kintovo records acknowledgement of the current Privacy Notice version and requires users to acknowledge a new version before continuing in protected workspace features.</p>
  </main>;
}
