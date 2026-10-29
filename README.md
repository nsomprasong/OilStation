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

Google and Facebook OAuth must be configured and tested in the specific Supabase Auth project. Authorized site/redirect URLs should include the application origin and `/auth/callback`. Do not enable public user registration in the application. The one-time invite RPC verifies a confirmed matching invited email. The **different-email Facebook verification workflow remains to be implemented** before claiming full feature parity.

### Database migrations

Current live Supabase migrations are `rebuild_oilstation_saas_schema_20261029`, `seed_oilstation_fuel_catalog_20261029`, `coupon_reserved_atomic_20261029`, `worker_least_privilege_20261029`, `fuel_session_settlement_20261029`, `accept_invitation_20261029`, and `coupon_shared_view_20261029`. The latter SQL files are kept in the feature branch. The first two live migrations predated version-control source capture; **do not reapply them**. `docs/database/2026-10-29-live-schema-inventory.json` is a read-only schema snapshot, not a runnable migration.

All 63 `public` tables have forced RLS and no public/authenticated table privileges. The backend has limited service role reads; financial writes use server-only SECURITY DEFINER RPCs. These restrictions are deliberate. Direct browser access to sensitive finance and biometric tables is blocked. No cross-tenant read policies have been opened.

### Financial domain

- Money transmitted as stringified integer satang, never JavaScript float.
- Coupon maximum is **reserved atomically at issuance** with `FOR UPDATE` wallet lock. If the available balance is insufficient, the issuance is rejected.
- Cancelled unstarted coupon releases once; active fueling holds are not released.
- Start fueling snapshots public and negotiated corporate price, factoring due price schedules.
- Finish fueling deducts actual discounted price, releases unused cap, and creates accounts receivable for credit-funded portion.
- Commission allocation follows Sales assignment effective dates; overpayments are recovered via future commission, not salary.
- Payroll arithmetic uses **approved** OT only; tax/SSO rates and legal deduction caps must be provided by a legally validated rules engine.

## Still required before first real customer

- Complete invite creation and transactional email delivery (currently only invite redemption).
- Configure Google/Facebook OAuth and different-email verification; customer/owner bootstrap.
- Authoritative camera/plate OCR verification, private photo upload and evidence checks, scanner endpoints, QR refresh/reissue, and concurrency stress testing.
- HR attendance screens, shifts, leave, biometric privacy workflow and statutory Payroll calculations.
- SaaS Billing/Stripe payment flow, bank/PromptPay payout adapters, invoice jobs and refund handling.
- Tenant-wide authorization test suite, RLS review, app build, staging tests, threat model, production configuration and user acceptance.
- No real payment collection or customer onboarding until these are complete and signed off.

## Superpowers workflow

Use specification → plan → failing tests → implementation → verification → code review. Open PRs without merging automatically. Production deploy requires separate explicit approval.
