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


### Additional guarded backend delivered (2026-10-29)

- A reviewed Cloudflare Worker Cron handler runs a service-role-only batch to expire unstarted coupons and release the reservation precisely once. SQL rollback tests passed; scheduling starts only when a reviewed Worker is actually deployed.
- Station employees can inspect a signed active QR after station membership checks; cancelled QR versions are rejected. The web UI supports native camera scanning where supported, or QR input fallback.
- A **private** Supabase Storage bucket (`oilstation-evidence`, JPEG/PNG, 5 MiB limit) receives station-authorized plate photos; browser requests cannot directly see other tenants' photos.
- The fuel start SQL now **requires a private photo object with a separately trusted OCR/supervisor attestation**. Uploaded files default to `pending_ocr`; even if an employee enters the correct plate text, fueling is refused until verified. This is a deliberate safety gate, not a complete OCR integration.
- HR planned/retrospective OT request records, partial minute approval and anti-self-approval checks are implemented and tested. Legal OT pay multipliers are **not automatically inferred or paid**.
- All public tables continue to use forced RLS; 65 public tables presently, with no customer test rows remaining.

**Unresolved:** Actual OCR provider and supervised image review, live camera edge cases, image retention/PDPA, protected pump/receipt images, full billing/payroll and externally configured OAuth/payment secrets. This is not ready for real fueling, real payroll or customer UAT.

## Security and UAT blockers

- The UI has no complete station-owner onboarding wizard or corporate company creation/top-up approval yet.
- Actual QR scanner, protected plate photo upload, reliable OCR/manual match approval, pump display checks and receipt evidence remain unconnected end to end. Do not run actual station transactions.
- No automatic email sending and different-email Facebook invitation verification are live.
- Full HR/Payroll and Stripe/PromptPay/LINE modules require additional implementation and Thailand compliance review.
- Run negative tests for cross-station member access, token replay, QR cancellation, concurrent coupon issuance, duplicate settlement and all staff/admin roles.
- All 65 public tables intentionally have RLS enabled with no `anon`/`authenticated` table access; privilege is through service-role-only RPCs with server validation.
- Test automation is a **dry run**; validate Cloudflare Worker Secrets, OAuth, real login and private test data on staging before first deploy.
- Finance and real customer data must remain disabled until acceptance tests and explicit production release approval.

## Future controlled rollout

1. Complete blockers, review PR, run CI and real isolated integration/UAT suite.
2. Confirm GitHub `main` HEAD, migration history, current Worker configuration and backup.
3. Agree on test release and, only when ready, deploy to `oilstation.goldensoft.cloud` without revealing secrets.
4. Check browser SSL, OAuth redirect, User/Org/Station separation, QR link invalidation and API error handling.
5. Share the test URL and scenario checklist with the user after the live deployment is **actually verified**.

**Do not state UAT ready until the site has been deployed and independently verified to serve the application rather than the maintenance placeholder.**


### Corporate top-up flow — private-slip implementation update (Oct 29)

- Private `oilstation-slips` Storage bucket (JPEG/PNG, 5 MiB) and uploader validated against both the customer's corporate account and a bank account **owned by that station**.
- Uploaded slip creates a pending request only. A second distinct manager with that station's finance role must inspect the original bank transfer in bank records, enter its reference and explicitly confirm money received before approving.
- The manager can download the private slip through an authenticated Worker endpoint; it is never exposed via public Storage URLs. Banking credentials are never sent to the browser.
- Protected approval uses an atomic database transaction: oldest outstanding corporate debt first, remainder into prepaid balance, immutable journal, single bank-reference reuse protection and idempotent replay.
- Database rollback tests covered permission isolation, absent/duplicate slip, no credit before approval, denied self-approval, required independent bank confirmation and repeated approval.
- **Limitation:** the bank feed itself is not integrated. A manager's explicit external-bank-statement confirmation is the trust boundary. Before real transfers, configure actual station bank accounts, reconcile negative and partial scenarios, test with at least two separate human identities and review cash-control procedures.
- **CI at branch `3b3cf9cb` passed 84/84 Node tests, frontend build and Wrangler dry-run** (run 40888284843). Neither an OAuth login nor a real bank transfer was end-to-end tested. Production Worker remains unchanged.
