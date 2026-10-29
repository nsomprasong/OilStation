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


## Continued implementation: fueling proof chain and attendance review (2026-10-29)

**Last verified CI:** Commit 72d01fa2 passed 140/140 Node tests, Vite build,
Worker syntax, Wrangler dry-run, and both GitHub workflow runs.
These are code/unit/mock tests, not isolated PostgreSQL integration tests.

### Commits in this increment
- ddb29405: Start fueling from an independently verified private plate photo ID.
- 84391a0d: Private pump and receipt evidence upload, station-scoped.
- fefa0c6b: OCR numeric preview only; no automatic settlement.
- 443db9af: Separate authorized manager review of actual photo and
  receipt/pump agreement; database-controlled finance settlement wrapper.
- 374f63cb: Thai mobile photo review queue and guarded finalization UI.
- da3e4e7f: Manager manual attendance review, immutable approval audit.
- 2efd670d: Thai mobile attendance-review UI with required reasons.
- 72d01fa2: Consistent Thai digits and separator normalization in SQL plate checks.

### Additional unapplied SQL migrations
- 20261029185000_verified_fuel_start_api.sql
- 20261029190000_fuel_photo_intake.sql
- 20261029191000_fuel_photo_ocr_preview.sql
- 20261029192000_supervisor_fuel_settlement.sql
- 20261029193000_attendance_supervisor_fallback.sql
- 20261029194000_thai_plate_normalization.sql

These six come after five earlier unapplied migrations (versions
20261029180000 through 20261029184000). Do not apply to the current
production Supabase project as a test. Migrate in version order to a
separate isolated development/staging database with explicit approval,
run SQL negative-role/foreign-station and concurrency tests, then review
rollback before applying to any customer environment.

### Safety contract
The pump never accepts client-supplied prices, fuel volume, or image URLs
as settled values. Start uses only a trusted photo ID. Both pump and
receipt photos are uploaded privately and OCR output remains unverified.
Only a distinct station supervisor may approve a photo after inspecting
the actual image, with explicit original readings. Both approved images
must have matching gross amounts. The settlement wrapper derives
liters, gross amount and private paths from approved database rows and
invokes the existing transactional hold-and-ledger settlement routine.
A repeated settlement may not charge funds twice.

GPS attendance likewise remains pending until separately reviewed.
Manual attendance approval records the supervisor and a reason, but it
must not claim face matching, liveness or legal biometric consent.
Payroll cannot rely on unreviewed punches.

### Explicit remaining release blockers
- Test new migrations and settlement against an isolated PostgreSQL DB.
- OCR accuracy on real Thai plates, pumps and receipts; retention and PDPA.
- Face identity/liveness, verified consent and safe manual fallback.
- Payroll statutory rules, OT payout, period lock, refunds, export/payee verification.
- Stripe checkout, signed webhook reconciliation, refund and idempotent invoice-paid.
- Sales commission journal/payout only against collected subscription revenue.
- LINE verified recipient binding and actual notification delivery testing.
- Google/Facebook OAuth provider config and invite-email ownership proof.
- Security/E2E mobile, finance concurrency, backup/restore and approvals.

**Draft PR stays open and unmerged. No live Worker deployment, no real
payments/fueling/payroll, no incremental user testing.** Integrated UAT
is permitted only after release gates and explicit authorization.


## Continuation — guarded SaaS Stripe Test Billing (2026-10-29)

**Current status**: test-mode implementation, not released.
- `3a49af96`: test-only Stripe PaymentIntents created server-side from issued
  SaaS invoices only, with persistent idempotency and authorized billing scope.
- `39b599a7`: signed payment_intent.succeeded event reconciles the exact
  database-bound Stripe intent, invoice, amount received, currency and
  payment-attempt identity inside one transaction. No station wallet credit.
- `0adde290`: scoped Thai invoice inbox and embedded Stripe Payment Element,
  only enabled when public key and explicit test flags are configured.
- `308509e8`: immutable invoice price/discount/VAT/lines and bound payment
  intent references once issued, with DB indexes.
- `54ec7261` / `ca8a01d4`: successful Stripe events are NOT ACKed unless
  reconciliation is enabled and succeeds; retry lookup GET bug fixed.
- `124a9108`: pure monthly/annual renewal preview with invoice price-change
  lead-time requirements, no automatic live renewal.
- `b13de50c`: invoice line billing-group scope, VAT snapshot arithmetic and
  stale Stripe idempotency protection.

**Verified quality at b13de50c**: both GitHub CI runs passed. 164/164
Node tests, Vite production build and Wrangler deploy dry-run passed.
Actual Stripe sandbox card/PromptPay payment and webhook retries, refunds,
chargebacks, product activation and production secrets are NOT tested.

### New unapplied migrations, in order
- 20261029195000_saas_test_payment_intent.sql
- 20261029200000_reconcile_test_saas_payment.sql
- 20261029201000_saas_billing_invoice_inbox.sql
- 20261029202000_saas_invoice_immutability.sql

Together with the 11 earlier unapplied migrations, **15 migrations in this
development series remain unapplied to the live Supabase project**.
Do not apply these to the current database without an isolated
PostgreSQL integration run, transaction concurrency/rollback tests,
billing group station-history test and explicit release approval.

### Stripe feature toggles, never committed secrets
- STRIPE_TEST_PAYMENTS_ENABLED=true
- STRIPE_TEST_RECONCILIATION_ENABLED=true
- STRIPE_SECRET_KEY=sk_test_... (encrypted Worker secret)
- STRIPE_WEBHOOK_SECRET=whsec_... (test endpoint secret)
- STRIPE_PUBLISHABLE_KEY=pk_test_... (public, only if test enabled)

These remain **OFF/UNSET**; this checkpoint does not configure or deploy them.
Real sk_live credentials are rejected by the test adapter.
Actual SaaS invoice issuance and statutory VAT/tax configuration are still
incomplete: this test-only checkout requires an already-issued invoice
with correctly reviewed pricing_snapshot, locked line items and
confirmed group station scope. It cannot be used to create arbitrary
invoice prices. PromptPay discount must already be represented on the
issued invoice; it is not automatically recomputed by Stripe.

**Outstanding accounting:** invoice generation, automated renewals
and notices, failure/dunning, refunds/chargebacks and paid adjustment,
Sales commission earned/payout journal, tax documents and legal review
are NOT completed. No automatic invoice/credit or customer notification
is done on a Payment Element browser success. Only the signed webhook
may mark a SaaS invoice paid.

Draft PR #1 stays open and unmerged; no production deployment or UAT.


## Further progress — reviewed SaaS invoices, Sales previews and isolated SQL CI

**Implementation summary (not production release):**
- Platform Super Admin can configure reviewed flat monthly/yearly QR/HR
  prices, an explicit tax policy, grouped stations with autopay disabled
  and provisional station subscriptions.
- Authenticated, strictly checked settings APIs and a Thai-first admin
  workspace. Prices for invoice drafts are queried from published
  database pricing rules, never arbitrary browser-supplied totals.
- Invoice draft/issue is two-phase: reviewed taxes, immutable snapshots,
  exact PromptPay 2% discount, integer satang accounting, per-line
  discount/tax split, one invoice per billing group and service window,
  and separate explicit review checkbox before issuing.
- Subscription quote rejects unsupported tiers/bundles/per-employee
  pricing, price overrides and group subscription gaps rather than
  producing guessed charges.
- Sales commission is a **read-only preview only** after invoice paid:
  net-of-VAT base, station and current Sales day share, explicit
  reviewed rules, no annual upfront or overlapping/ambiguous assignments.
  No commission entitlement or payout/ledger is created by this flow.
- Added **disposable PostgreSQL 16 integration workflow** under
  .github/workflows/billing-postgres.yml using test/integration/ fixtures
  and migration source files. It actually executes the relevant SQL
  migrations against a non-production database and runs assertions for
  role isolation, cross-org groups, price lock, duplicate period,
  payment-method repricing, tampered Stripe amounts, same-event replay,
  Sales source and full transaction rollback. This is a billing-only
  parity fixture, not a complete copy of the live Supabase database.

**Quality gate:** Node unit tests 179/179 passed and Wrangler dry-run
and Vite build passed at dc5c2b06. The isolated PostgreSQL workflow
passed on 3417b03c after fixing ambiguity in a test-only SQL variable.
Latest commit CI outcome should be checked before release statements.

### New SQL migrations not applied to live Supabase
- 20261029203000_platform_saas_configuration.sql
- 20261029204000_saas_flat_invoice_draft.sql
- 20261029205000_platform_saas_billing_overview.sql
- 20261029206000_commission_preview_after_paid.sql

Total un-applied migrations for this development series: **19**.
No platform pricing, tax or organization records have been inserted
into the live database. No real Stripe transactions were attempted.
The setup UI and draft data require real company tax/legal and rate
review plus integration against a full isolated schema before launch.

### Remaining gates: explicitly not completed
- Full Supabase schema parity test and all 19 migration integration/rollback
  checks, after review of older fueling/GPS/LINE migrations.
- Complete billing lifecycle: approved promotion rules, per-employee/
  bundle/tier pricing, annual subscriptions, automatic renewal,
  notices, pro-rata plan changes, dunning, grace, chargebacks/refunds,
  credit notes, invoice numbers/statutory tax documents.
- Signed Stripe sandbox 3DS/card/PromptPay end-to-end, webhook replay,
  provider fetch reconciliation and test-mode event isolation.
- Sales commission actual ledger accrual after *real* collected money,
  refund/reassignment adjustments, upfront yearly policy, payouts.
- Production OAuth invitations, LINE verified opt-in, employee payroll,
  accurate biometrics/PDPA, station fuel camera/device/UAT tests.
- Final integrated user UAT at the custom domain after security approvals.

**Still:** No merge; no Cloudflare deploy; no changes to live Supabase;
feature flags remain off, no money moved and no client UAT yet.


## Continuation — HR attendance PostgreSQL review, replay and payroll preview

**Development only; no Supabase migration, production deploy, or customer UAT.**

New work on the same Draft PR:
- GPS idempotency-key replay reports latest persisted attendance review status and geofence, not forever pending; faceVerified remains false.
- Manual supervisor attendance audit is append-only with database trigger guarding UPDATE/DELETE; PostgreSQL regression tests cover both.
- Reviewed work minutes accept real GPS seconds and milliseconds, subtract exact breaks, then floor total worked minutes conservatively.
- New read-only HR reviewed-attendance RPC requires EVERY punch in period to have a matching independent accepted supervisor_manual audit. Pending, rejected, and legacy accepted-without-audit punches fail closed.
- Local-calendar RPC uses station IANA timezone for startDate/endDate windows, including Bangkok midnight shifts crossing UTC dates.
- GET /api/hr/attendance/payroll-preview and Thai manager selector show independently reviewed time as a draft, never an actual salary approval or payout.
- GitHub Actions Attendance SQL Integration uses disposable PostgreSQL 16, schema fixtures, 2 stations and staff, GPS geofences, nonce replays, cross-station roles, self-review, append-only audit, no-payroll-without-review and midnight date-window checks.

**Verified at commit 341a70d0:** 189/189 Node unit tests PASS, Vite build PASS, Wrangler deploy dry-run PASS, and BOTH PostgreSQL Billing and Attendance Integration PASS.
The PostgreSQL fixture is isolated, not a full Supabase schema clone; the production release is NOT cleared.

**Unapplied development migrations:** 20, including the new 20261029207000_hr_reviewed_time_preview.sql.
Previously staged HR migrations 20261029181000 and 20261029193000 were corrected but still have NOT been applied to Supabase.

**Outstanding:** true face/consent/liveness workflow or reviewed non-biometric fallback; complete statutory payroll/OT/advances and paid-period locking; bank export/reconciliation; isolated full-schema migration+security UAT for other modules; Stripe sandbox/refund/dunning; LINE and OAuth; backups, rollback and customer UAT.
Draft PR #1 remains unmerged, not deployed; Stripe test flags remain off; no funds moved.


## Continuation — isolated fuel finance integration and bypass prevention

**Development only; no Supabase migrations or Cloudflare deployment performed.**

Security fixes and testing added:
- Discovered and closed a real trust-boundary flaw: after all trusted wrappers are installed, the service_role cannot execute raw start_reserved_fuel_session or finish_reserved_fuel_session directly to bypass plate, pump, or receipt review. New migration: 20261029208000_fuel_private_finance_gate.sql. Audited wrappers retain EXECUTE as required.
- Raw finance settlement now checks station staff authorization BEFORE returning the completed-session replay result. An actor from another station must not read previously settled financial values.
- New disposable PostgreSQL 16 GitHub Actions workflow, .github/workflows/fuel-postgres.yml. Its test fixtures mirror key live schema columns and financial constraints and apply selected real migration SQL, never customer data.
- Executable SQL tests cover cross-corporate issuance rejection, cross-station fuel product rejection, coupon nonce and amount replay, over-reservation rollback, checked private plate object, forbidden foreign station start and settlement, single fuel session per coupon, manual independent pump+receipt photo review, no settling with pending photos, reviewed settlement and financial ledger atomicity.
- The fake financial scenario verifies 20,000 satang pump gross, 17,500 satang net, prepaid consumption 10,000 satang, 7,500 satang debt, and 2,500 satang released hold; the same photo/replay cannot post wallet or accounts-receivable ledger twice.
- Cancellation and expiry each release the hold exactly once, without touching already completed/fueling coupons.
- Cross-station coupon replacement within the SAME corporate company is atomic. An insufficient destination wallet rolls back old cancellation and new hold; unrelated companies cannot switch it. An original shared link follows its valid successor; duplicate replacement does not create extra ledger entries.
- Test changes the station public price and corporate price rule after the session started to prove the original locked price remains authoritative at settlement.

**Verified at 683c1312:** 191/191 Node tests pass; Vite build and Wrangler dry run pass. All three independent PostgreSQL integration workflows Billing, Attendance, Fuel passed. They use purpose-built fixtures and do NOT constitute full production schema migration or photo-liveness UAT.

**Unapplied development SQL migrations:** 21, including new 20261029208000 gate. Existing edited coupon/fuel migrations are also NOT applied live.

Outstanding before production: full-schema Supabase staging parity tests, migration transaction order and stored evidence/RLS audit, real private photo review and anti-replay/liveness UAT, connected station device testing, live price schedules, refunds/reversals, offline conflict handling, concurrency/lock stress tests, OAuth, LINE, signed Stripe sandbox, legal payroll review, bank reconciliation and production rollback exercises.

Draft PR remains unmerged; Cloudflare domain has not received this code; service flags off; no real customer financial transaction.
