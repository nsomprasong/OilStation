# OilStation — Private Test Release Checklist

**Status:** NOT YET READY FOR USER ACCEPTANCE TEST (UAT)  
**Target URL:** https://oilstation.goldensoft.cloud  
**Last reviewed:** 2026-10-29

## Why the domain is not yet running this app

The existing Cloudflare Worker `oilstation` intentionally serves a maintenance placeholder. Repository code remains on `feature/bootstrap-foundation-20261029` in [draft PR #1](https://github.com/nsomprasong/OilStation/pull/1). GitHub Actions validates the Worker/frontend bundle using Wrangler `--dry-run`, but no live deploy has occurred.

Do not publish this code until the **minimum invite-only onboarding, authorization, coupon issuing and pump validation journey** has been exercised end to end. The current UI includes foundation screens, but complete roles, invitation email delivery, OCR/photo checks, payment and HR/Payroll workflows are still pending.

## Before enabling real sign-in

1. In **Supabase project `cxihsotcpdnalswfoysx`**, configure Google and Facebook OAuth provider credentials. Never paste OAuth Client Secrets into chat or GitHub.
2. Site URL: `https://oilstation.goldensoft.cloud`; allowed redirect: `https://oilstation.goldensoft.cloud/auth/callback`. In Google/Facebook developer consoles, use Supabase provider callback `https://cxihsotcpdnalswfoysx.supabase.co/auth/v1/callback` as documented for each provider.
3. In the Cloudflare Worker, configure the following bindings via **encrypted Secrets** (not Git or browser):
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase secret; never log it.
   - `COUPON_SIGNING_KEY`: a securely generated random key, 32+ characters, with securely backed up lifecycle. Rotating it invalidates old coupon URLs unless key rotation is implemented.
   - `BOOTSTRAP_ADMIN_EMAIL`: the exact, verified email approved for **first** platform admin setup (must be explicitly chosen).
   - `SUPABASE_ANON_KEY`: Supabase project's public anon/publishable key, used in browser auth bootstrap.
   - `SUPABASE_URL`: `https://cxihsotcpdnalswfoysx.supabase.co`.
4. Verify provider settings, claims, invite redemption and role scopes using test accounts and private browser sessions. The platform first admin uses `/setup`, which allows only the server-whitelisted verified email and only while no platform superadmin exists.

## Capabilities implemented on the development branch

- First-admin bootstrap; station creation with brand template and QR/HR selection; initial products disabled and unpriced.
- Station fuel price/enablement management with audit versions.
- One-time scoped invitation creation and redemption. **Automatic invitation email sending is not yet connected**; approved inviter sees a shareable link for manual delivery in this initial build.
- Company account overview and fuel offers with server-side company authorization, coupon issuance and funds reserved immediately, signed public link viewer.
- Core financial DB routines for cancellation, replacement, fueling start price lock and discounted settlement.
- Pure commission/payroll calculations only (no production payroll approvals, statutory tax rules or bank payouts yet).

## Security and UAT blockers

- The UI has no complete station-owner onboarding wizard or corporate company creation/top-up approval yet.
- Actual QR scanner, protected plate photo upload, reliable OCR/manual match approval, pump display checks and receipt evidence remain unconnected end to end. Do not run actual station transactions.
- No automatic email sending and different-email Facebook invitation verification are live.
- Full HR/Payroll and Stripe/PromptPay/LINE modules require additional implementation and Thailand compliance review.
- Run negative tests for cross-station member access, token replay, QR cancellation, concurrent coupon issuance, duplicate settlement and all staff/admin roles.
- All 63 public tables intentionally have RLS enabled with no `anon`/`authenticated` table access; privilege is through service-role-only RPCs with server validation.
- Test automation is a **dry run**; validate Cloudflare Worker Secrets, OAuth, real login and private test data on staging before first deploy.
- Finance and real customer data must remain disabled until acceptance tests and explicit production release approval.

## Future controlled rollout

1. Complete blockers, review PR, run CI and real isolated integration/UAT suite.
2. Confirm GitHub `main` HEAD, migration history, current Worker configuration and backup.
3. Agree on test release and, only when ready, deploy to `oilstation.goldensoft.cloud` without revealing secrets.
4. Check browser SSL, OAuth redirect, User/Org/Station separation, QR link invalidation and API error handling.
5. Share the test URL and scenario checklist with the user after the live deployment is **actually verified**.

**Do not state UAT ready until the site has been deployed and independently verified to serve the application rather than the maintenance placeholder.**
