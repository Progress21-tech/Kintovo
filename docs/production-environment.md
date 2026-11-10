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
AUTH_URL="https://YOUR_DOMAIN"
AUTH_TRUST_HOST="true"

# Temporary launch switch. Keep false until SMTP and a verified sending domain are ready.
REQUIRE_EMAIL_VERIFICATION="false"

# SMTP provider credentials. Required for production signup and password recovery.
SMTP_HOST="YOUR_SMTP_HOST"
SMTP_PORT="587"
SMTP_USER="YOUR_SMTP_USERNAME"
SMTP_PASSWORD="YOUR_SMTP_PASSWORD"
EMAIL_FROM="Kintovo <no-reply@YOUR_DOMAIN>"

# Optional AI; keep disabled until configured and reviewed.
AI_PROVIDER="none"
AI_API_BASE_URL=""
AI_MODEL=""
AI_API_KEY=""

# Keep live payment operations disabled.
PAYMENT_MODE="simulated"
PAYMENT_PROVIDER_NAME="UNCONFIGURED"
PAYMENT_WEBHOOK_SECRET=""
```

The URLs above are shapes/examples only. Copy Neon’s pooled URL into `DATABASE_URL` for the app and its direct/unpooled URL into `DIRECT_URL` for Prisma CLI migrations. This repository's Prisma 7 config now reads `DIRECT_URL` for migrations; the runtime Prisma adapter reads `DATABASE_URL`. Use `sslmode=verify-full` explicitly; it preserves the current certificate-verifying behaviour and avoids the `pg-connection-string` deprecation warning. Do not add quote characters around values in Vercel's environment-variable form. Use separate databases/branches for Preview and Production so preview deployments cannot modify production data. Prisma recommends pooled connections for serverless app traffic and direct connections for migrations. [Prisma connection guidance](https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections)

To generate a secret in PowerShell, run:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Paste the resulting value directly into Vercel's `AUTH_SECRET` field. Do not paste it into chat, commit it, or put it in `.env.example`.

## Cloudflare setup

- Add and verify your domain in Cloudflare, then use Cloudflare's nameservers at your domain registrar if Cloudflare will manage DNS.
- Add the domain to the Vercel project. Copy the exact DNS records Vercel requests into Cloudflare DNS; Vercel provisions HTTPS after DNS verification. Start with DNS-only records if you want the simplest setup, then enable Cloudflare proxy features after confirming Vercel routing and client-IP handling.
- Set `AUTH_URL` to the final canonical HTTPS origin (for example, `https://kintovo.example`). This origin is also used to build account verification, reset-password, invitation, and referral links.
- Turnstile can help block automated login/registration abuse, but it is not authentication. The app does not currently implement Turnstile. After creating a Turnstile widget, its public site key can be exposed as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and its secret stored as `TURNSTILE_SECRET_KEY`; the widget must be added to the forms and each token validated on the server before those settings provide protection. Create widget hostnames for the production domain and any preview/test domain you intend to protect.
- Cloudflare Access is designed to gate access to an application for a defined group, and would prevent ordinary public customers from using Kintovo if applied to the whole site. Do not use it as the public user-account login system.

## SMTP verification checklist

When `REQUIRE_EMAIL_VERIFICATION=true`, the registration form intentionally fails closed in production when `SMTP_HOST` or `EMAIL_FROM` is missing. Until a verified sending domain is available, set `REQUIRE_EMAIL_VERIFICATION=false`; new users can sign up and sign in, while the verification token workflow remains available for later activation. Configure all SMTP variables in the deployed environment, then redeploy because Vercel environment changes apply to new deployments. Use a sender address allowed by the SMTP provider and, for authenticated SMTP, set `SMTP_USER` and `SMTP_PASSWORD`.

When enabling verification, create a test account and confirm that the message arrives, the link uses the production `AUTH_URL`, and `/verify-email` redirects to sign-in. If delivery fails after the configuration guard passes, inspect the server log entry `Signup verification email delivery failed`; it indicates a provider, credential, port, sender, or TLS problem rather than a database problem. Existing accounts created while the flag was false will also need verification after the flag is turned on.

## Before the first production deploy

The repository currently lacks a committed npm lockfile and initial Prisma migration, and its build has not been run. Use a Node.js 22.18+ environment to install dependencies, generate and review the initial migration against a development database, commit `package-lock.json` and `prisma/migrations/`, and run the project's verification commands. Apply the reviewed migration to the Neon production database with `npm run db:deploy` as a release step, not with `migrate dev`.

Do not enable real payments: Kintovo currently records simulated payment activity only. Configure database backups, test email verification and password recovery on a preview deployment, and verify the custom domain and HTTPS before directing production users to the app.
