# OilStation

Multi-tenant fuel station SaaS: QR Fuel Coupon + HR/Payroll + SaaS Billing and Sales Commissions.

> Development status: **under construction**. This branch is not ready for customer use. Do not deploy or merge without explicit review/approval.

## Services

- Supabase project: `cxihsotcpdnalswfoysx` (Singapore).
- Cloudflare Worker: `oilstation`, custom domain: `oilstation.goldensoft.cloud`. Current production Worker is a separate holding page; this code is **not yet deployed**.
- Source design: `docs/superpowers/specs/2026-10-29-oilstation-saas-design.md`.
- Iterative implementation: `docs/superpowers/plans/2026-10-29-oilstation-implementation.md`.

## Local setup

Node.js 22+ is needed. Verify the local working tree, HEAD and changes before editing.

```sh
npm install
npm run check
npm test
npm run build
npx wrangler dev
```

Put Supabase server credentials and coupon signing secret in `.dev.vars` using `.dev.vars.example` as a guide; never commit the actual values. Set production secrets through Cloudflare Worker Secrets **only after approval**. Publishable anon keys may be sent to browsers; service role credentials and signing secrets must never appear in frontend bundles, logs, Git history, or error responses.

### OAuth configuration not completed

Google and Facebook OAuth must be configured and tested in the specific Supabase Auth project. Authorized site/redirect URLs should include the application origin and `/auth/callback`. Do not enable public user registration in the application. The one-time invite RPC verifies a confirmed matching invited email. Different-email Facebook/Google invitation proof now has a server-only, time-limited OTP code path; it is NOT yet live-tested against actual OAuth providers or a verified outbound sender.

### Database migrations

Read-only Supabase inspection (Oct 29, 2026) confirmed **30 applied
production migrations, 65 public tables with forced RLS, and no direct
anon/authenticated CRUD or public RPC EXECUTE grants**. The Draft PR
contains **26 newer, unapplied SQL migrations** starting at
20261029180000 and ending at 20261029213000. Do not reapply the 30
historical production migrations, merge the PR, or deploy to
oilstation.goldensoft.cloud until reviewed and authorized.

The seven SQL-related test workflows now include a live-metadata-shaped
65-table PostgreSQL schema fixture (no customer records), a full sequential
migration test, isolated billing/fuel/attendance/topup suites, invitation
email OTP verification, and cross-module finance. These checks are **not**
a substitute for real isolated Supabase Auth/Storage runtime and external
provider testing.

### Financial domain

- Money transmitted as stringified integer satang, never JavaScript float.
- Coupon maximum is **reserved atomically at issuance** with `FOR UPDATE` wallet lock. If the available balance is insufficient, the issuance is rejected.
- Cancelled unstarted coupon releases once; active fueling holds are not released.
- Start fueling snapshots public and negotiated corporate price, factoring due price schedules.
- Finish fueling deducts actual discounted price, releases unused cap, and creates accounts receivable for credit-funded portion.
- Commission allocation follows Sales assignment effective dates; overpayments are recovered via future commission, not salary.
- Payroll arithmetic uses **approved** OT only; tax/SSO rates and legal deduction caps must be provided by a legally validated rules engine.

## Still required before first real customer

- Optional invitation email and alternate OAuth mailbox OTP are implemented but disabled until a verified sender, OAuth credentials and real provider-delivery tests are configured.
- Configure Google/Facebook OAuth and different-email verification; customer/owner bootstrap.
- Authoritative camera/plate OCR verification, private photo upload and evidence checks, scanner endpoints, QR refresh/reissue, and concurrency stress testing.
- HR attendance screens, shifts, leave, biometric privacy workflow and statutory Payroll calculations.
- SaaS Billing/Stripe payment flow, bank/PromptPay payout adapters, invoice jobs and refund handling.
- Tenant-wide authorization test suite, RLS review, app build, staging tests, threat model, production configuration and user acceptance.
- No real payment collection or customer onboarding until these are complete and signed off.

## Superpowers workflow

Use specification → plan → failing tests → implementation → verification → code review. Open PRs without merging automatically. Production deploy requires separate explicit approval.


### Optional automatic invitation email (disabled by default)

Scoped invites and first corporate-admin invites now support provider-accepted
email requests, but **do not claim delivery**. After verifying your sending
domain, configure these **Cloudflare Worker encrypted secrets** (not browser
environment variables or GitHub source): INVITATION_EMAIL_ENABLED=true,
INVITATION_FROM_EMAIL=invite@YOUR_VERIFIED_DOMAIN, and RESEND_API_KEY.

The trusted Worker calls Resend's email API using an invitation-ID idempotency
key. Any provider failure or ambiguous response shows the existing manual
invitation link; **database invitation creation is not rolled back**. A
successful 2xx response means *accepted for sending*, not inbox delivery.
Real sender authentication (SPF/DKIM), bounce monitoring and OAuth invitation
redemption tests are mandatory before enabling the feature. The current
database requires exact, confirmed ownership of the invited email; different
Facebook/Google email identities still require an independently approved
verification flow before production release.
