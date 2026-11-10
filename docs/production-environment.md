# Production environment setup

This project is deployed as a Next.js app on Vercel. Cloudflare can host DNS for the custom domain and provide Turnstile bot checks. Neon provides the PostgreSQL database. Cloudflare is not currently the application's sign-in provider: Kintovo uses Auth.js credentials (email and password), with optional email verification and password recovery delivered by SMTP.

## Vercel Production variables

Add these under **Vercel → Project → Settings → Environment Variables**, scoped to Production. Add separate Preview values if you enable preview deployments.

```dotenv
# Neon: copy the pooled PostgreSQL connection string from the Neon dashboard.
# Use the production database/branch here. Keep the complete URL private
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=verify-full"

# Neon direct/unpooled connection string, used by Prisma CLI migrations.
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST/DBNAME?sslmode=verify-full"

# Generate a unique random secret. Never reuse the example text.
AUTH_SECRET="GENERATE_A_UNIQUE_RANDOM_SECRET"
AUTH_URL="https://YOUR_PROJECT.vercel.app"
AUTH_TRUST_HOST="true"

# Users must verify their email before signing in.
REQUIRE_EMAIL_VERIFICATION="true"

# SMTP provider credentials. Required for production signup and password recovery.
SMTP_HOST="YOUR_SMTP_HOST"
SMTP_PORT="587"
SMTP_USER="YOUR_SMTP_USERNAME"
SMTP_PASSWORD="YOUR_SMTP_PASSWORD"
EMAIL_FROM="Kintovo <hello@YOUR_EMAIL_DOMAIN>"

# Optional AI scope planner (Google AI Studio free tier; add your server-side key).
AI_PROVIDER="gemini"
AI_API_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
AI_MODEL="gemini-3.8-flash"
AI_API_KEY=""

# Optional Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Keep live payment operations disabled.
PAYMENT_MODE="simulated"
PAYMENT_PROVIDER_NAME="UNCONFIGURED"
PAYMENT_WEBHOOK_SECRET=""
PLATFORM_FEE_BPS="0"
PLATFORM_FEE_PAYER="BUSINESS"
```

`PLATFORM_FEE_BPS` is expressed in basis points (`1000` = 10%). It remains `0` until Kintovo's fee policy, transaction persistence, provider settlement, refunds, and customer disclosures are implemented and approved. Do not treat this environment value alone as a live fee charge.

The URLs above are shapes/examples only. Copy Neon’s pooled URL into `DATABASE_URL` for the app and its direct/unpooled URL into `DIRECT_URL` for Prisma CLI migrations. This repository's Prisma 7 config now reads `DIRECT_URL` for migrations; the runtime Prisma adapter reads `DATABASE_URL`. Use `sslmode=verify-full` explicitly; it preserves the current certificate-verifying behaviour and avoids the `pg-connection-string` deprecation warning. Do not add quote characters around values in Vercel's environment-variable form. Use separate databases/branches for Preview and Production so preview deployments cannot modify production data. Prisma recommends pooled connections for serverless app traffic and direct connections for migrations. [Prisma connection guidance](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

To generate a secret in PowerShell, run:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Paste the resulting value directly into Vercel's `AUTH_SECRET` field. Do not paste it into chat, commit it, or put it in `.env.example`.

`AUTH_SECRET` is required for Auth.js sessions and Google OAuth. If it is empty or missing, sign-in and OAuth callbacks will fail. Generate it once, store it in the appropriate Vercel environments, and redeploy after adding it.

## Cloudflare setup

- Add and verify your domain in Cloudflare, then use Cloudflare's nameservers at your domain registrar if Cloudflare will manage DNS.
- Add the domain to the Vercel project. Copy the exact DNS records Vercel requests into Cloudflare DNS; Vercel provisions HTTPS after DNS verification. Start with DNS-only records if you want the simplest setup, then enable Cloudflare proxy features after confirming Vercel routing and client-IP handling.
- Set `AUTH_URL` to the final canonical HTTPS origin (for example, `https://kintovo.example`). This origin is also used to build account verification, reset-password, invitation, and referral links.
- Turnstile can help block automated login/registration abuse, but it is not authentication. The app does not currently implement Turnstile. After creating a Turnstile widget, its public site key can be exposed as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and its secret stored as `TURNSTILE_SECRET_KEY`; the widget must be added to the forms and each token validated on the server before those settings provide protection. Create widget hostnames for the production domain and any preview/test domain you intend to protect.
- Cloudflare Access is designed to gate access to an application for a defined group, and would prevent ordinary public customers from using Kintovo if applied to the whole site. Do not use it as the public user-account login system.

## SMTP verification checklist

With `REQUIRE_EMAIL_VERIFICATION=true`, users receive a verification email after registration and cannot sign in until they use the link. The registration form fails closed in production when `SMTP_HOST` or `EMAIL_FROM` is missing. Configure all Resend SMTP variables in the deployed environment, then redeploy because Vercel environment changes apply to new deployments. Use a sender address allowed by the verified Resend domain and set `SMTP_USER=resend` and `SMTP_PASSWORD` to the Resend API key.

## Google OAuth

Create a Google OAuth Web application and add this authorised redirect URI:

`https://YOUR-AUTH-URL.vercel.app/api/auth/callback/google`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the same Vercel environment as `AUTH_URL`, then redeploy. Google-verified accounts are treated as email-verified; email/password accounts still require the Kintovo verification email. Google sign-in creates an account without a password, so the user must continue using Google for that account.

## AI scope planning

The project brief AI checkbox is opt-in. The default provider is Google's OpenAI-compatible Gemini API using `gemini-3.8-flash`; add an API key from Google AI Studio as the server-only `AI_API_KEY` environment variable. The model has a free tier, but Google's free-tier policy may use submitted content to improve products; the form tells users this before consent. Do not send confidential project data on the free tier. Free-tier limits apply, so use an appropriately protected paid tier before processing sensitive production briefs. To use another OpenAI-compatible provider, set `AI_PROVIDER="compatible"`, `AI_API_BASE_URL` to the provider's chat-completions endpoint, `AI_MODEL` to an approved model name, and `AI_API_KEY` to its server-only key. The user can brainstorm about the entered goal in the brief form; the final structured plan is generated from both the full brief and that conversation, then remains editable before submission. If the user opts in but the provider is unavailable, invalid, or times out, the brief is not saved as if it had received AI recommendations; the user sees an error and can retry or choose the rules-based planner.

Create a test account and confirm that the success message instructs the user to verify their email, the message arrives, the link uses the production `AUTH_URL`, and `/verify-email` redirects to sign-in. If delivery fails after the configuration guard passes, inspect the server log entry `Signup verification email delivery failed`; it indicates a provider, credential, port, sender, or TLS problem rather than a database problem.

Account emails use a Kintovo-branded HTML layout with a clear action button and retain a plain-text fallback. The visible sender is controlled by `EMAIL_FROM`; the destination domain in verification links is controlled by `AUTH_URL`. If the app is still hosted on Vercel, use its exact production `.vercel.app` URL for `AUTH_URL`; this is independent from the verified Resend sender domain in `EMAIL_FROM`. Resend may still display security or tracking details around a link, but users will see the branded Kintovo button rather than an unexplained raw URL.

## Before the first production deploy

The repository currently lacks a committed npm lockfile and initial Prisma migration, and its build has not been run. Use a Node.js 22.18+ environment to install dependencies, generate and review the initial migration against a development database, commit `package-lock.json` and `prisma/migrations/`, and run the project's verification commands. Apply the reviewed migration to the Neon production database with `npm run db:deploy` as a release step, not with `migrate dev`.

Do not enable real payments: Kintovo currently records simulated payment activity only. Paystack Dedicated Virtual Accounts can provide an NGN account for an eligible customer, but Paystack requires a registered Nigerian business and successful go-live approval; they are not automatically available for every Specialist or Creator. A production DVA flow must create/validate the customer, assign the account, verify `charge.success` webhooks, reconcile idempotently, and restrict funding actions to authorised organisation owners/admins. Configure database backups, test email verification and password recovery on a preview deployment, and verify the custom domain and HTTPS before directing production users to the app.
