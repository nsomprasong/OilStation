# OilStation — developer checkpoint (29 Oct 2026)

## Non-negotiable release rule
**Do not merge, deploy, turn on billing, or solicit partial manual UAT.**
The user will test once through `https://oilstation.goldensoft.cloud` only
after an isolated staging integration, security review, and release gate pass.
The original Worker/domain remain unchanged until explicit gate completion.

## Repo and verification
- Repo: `nsomprasong/OilStation`
- Branch: `feature/bootstrap-foundation-20261029`
- Draft PR: https://github.com/nsomprasong/OilStation/pull/1 (open, unmerged)
- Verified head at checkpoint: `f82f70410d7e761ee2c534c13e758cabd10febfc`
- Last verified GitHub CI: **117/117 automated tests passed**; Vite build,
  Worker syntax and Wrangler dry run passed (runs 40894067874, 40894056927).
- `rolldown` is npm-overridden to 1.2.15 after 1.2.16 tarball 404.
- Production Supabase baseline is healthy, 65 public tables with
  intentional RLS deny-all and server-side RPC access. **The new migrations
  below are committed only; not applied to live DB.**
- Supabase project: `cxihsotcpdnalswfoysx`, Worker: `oilstation`.

## Implemented in this increment (code + mock/unit CI only)
1. Private Thai plate OCR + Google Vision adapter, conservative confidence
   and exact normalized plate comparison, with supervisor two-person review.
2. Authorized manager-only pending photo inbox and no-store private image view
   so manager can inspect the original photo before approving.
3. GPS punch (mobile) with coordinate accuracy guard, station geofence,
   replay-safe key, and only `pending` attendance (never payroll-approved).
4. Stripe signed **test-mode** event inbox: raw-body HMAC, 5 min tolerance,
   replay protection, no automatic invoice/ledger mutation.
5. LINE push transport: restricted messages linking to authenticated app,
   verified opt-in binding, retry key, worker flag OFF unless configured.
6. Billing quote in integer satang, 2% PromptPay discount after promotion,
   VAT mode must be specified (not implicitly inferred).
7. Payroll work-time draft requires fully reviewed punch pairs and
   rejects pending/overlapping/invalid shifts; not a payroll payout.
8. Thai mobile panels and additional tests; responsive design guidelines
   from installed `design-taste-frontend` used.

## New *unapplied* migrations (stage in isolated DB before production)
- `20261029180000_plate_ocr_review.sql`
- `20261029181000_gps_attendance_pending.sql`
- `20261029182000_stripe_signed_event_inbox.sql`
- `20261029183000_line_verified_delivery_queue.sql`
- `20261029184000_plate_review_inbox.sql`

## Still incomplete / release blockers
- OCR of pump meter, fuel receipt and final amount reconciliation, safe
  full fueling completion flow; validate Thai plate OCR on real images.
- Face attendance: liveness, verified face identity, legal basis/consent,
  biometric retention/deletion, and supervisor manual fallback.
- Payroll: approved attendance-to-wage payrun, OT rules, reviewed Thai
  tax/social-security calculations, lock/review/export and bank payout.
- Stripe: secure test PaymentIntent creation, Payment Element/PromptPay
  customer UI, provider-side settlement reconciliation and refunds,
  invoicing/paid-state mutation after independent verification.
- Sales commissions: collect-only entitlement accrual, effective-date
  transfers, reversals, payouts and ledger-backed reports.
- LINE: independently verified identity binding and opted-in recipients,
  configured encrypted LINE secret; transport remains disabled.
- Google/Facebook OAuth: Supabase provider credentials, redirect allowlist,
  invitation email verification, actual end-to-end login tests.
- Apply and test migrations on **isolated staging**, run SQL rollback and
  cross-tenant security checks, concurrency/replay/camera/device E2E,
  security/privacy review, backups and recovery drills.
- Credentials: Worker secret `GOOGLE_VISION_API_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` and provider setup;
  do not store secrets in GitHub files or source.
- Supabase advisor emits RLS-no-policy info for service-only deny-all tables,
  as designed. Review missing foreign-key indexes before a high-load launch.

## One-time integrated release criteria
- All provider integrations and business workflows functional on staging.
- Real camera/OCR/receipt, geofence/face, payroll, OAuth, payments,
  commissions, LINE are tested end-to-end with legitimate test accounts.
- Zero unresolved cross-tenant leaks, unsafe biometric handling, double
  credits, overcharged invoices, repeat webhook payouts or stranded funds.
- CI and Worker dry-run green; migration and rollback proofs recorded.
- Feature toggles and secrets reviewed; release explicitly approved.
- **Then** prepare a single integrated test at
  `oilstation.goldensoft.cloud`; do not merge or deploy ahead of that gate.
