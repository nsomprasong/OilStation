# QA-20261103-POSTDEPLOY-READONLY-001 — OilStation live continuation

**Status:** APPROVED — bounded read-only execution only (owner requested "ทดสอบต่อจากที่ค้างไว้" on 2026-11-03)
**Repository:** `nsomprasong/OilStation`, base `main`, frontend release PR #118 / `2cc592ca858af43e`
**App:** https://oilstation.goldensoft.cloud
**Current DB:** Supabase `cxihsotcpdnalswfoysx`; **no staging or branch**
**Execution:** GitHub Actions real Chromium, protected `oilstation-qa` role tests only after matching reviewed production-preview deployment. This test run does not ask for new secrets or activate banking/payroll.

## Scope and fixed QA actor universe

- Login: Google/Facebook buttons and QA username/password, **login only**, reference visual at 360, 390, 430, 768, 1280, and 1440 px.
- Existing fixed QA actors: Sales01 and Sales02; each controls two QA stations (4 total); 3 QA corporate-station accounts per station (12 total). Run the existing read-only Sales/station owner/corporate/cashier role workflow; verify same mobile login still works.
- Station fuel catalog and price edit affordance **without Save**; corporate driver/QR form **without Issue**; pump entry **without Scan/Fuel**.
- HTTP preview-only safety: unauthenticated API guard and `/api/health` 200, `/api/ready` 503, `/api/coupons` release-disabled, payroll creation/review read route unauthorized/release-gated, no public registration.
- HR roster/attendance/payroll review and finance pending: only where already readable. Expected `BLOCKED` when business APIs remain release-locked; do not enable them merely to pass a test.

## Read-only preflight baseline recorded on 2026-11-03

- Cloudflare deployed Worker ID `4c28664c-d1b4-4282-bb4e-ff0c59d3281e`, 100% version `787f87f8-540b-49cc-898c-64495a6d4ed0` before this test-only PR.
- Worker `OILSTATION_DEPLOY_TARGET=production`, `OILSTATION_API_ENABLED=false`, `OILSTATION_PREVIEW_LOGIN_ENABLED=true`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`.
- Supabase project confirmed `ACTIVE_HEALTHY`. Exact scoped fixed QA station count **4**; corporate-station account rows **12**; employee rows **3**.
- Monetary and payout protected baseline: `payroll_payouts=0`, `payroll_lines=0`, `bank_export_batches=0`, `saas_test_refund_journal=0`, `saas_test_dispute_review_events=0`, `hr_station_payroll_policies=0`; one historic SaaS invoice. `wallet_ledger=5`, `audit_events=254`. Values read through bounded SELECTs, no personal data exported.
- Full backup/recovery drill **NOT VERIFIED**. Consequently **no DB writes, no test fixtures, no cleanup/reset**, no real payments or messages.

## Test matrix

| ID | Actor | Action | Expected result |
|---|---|---|---|
| POST-LOGIN-01 | Guest (6 viewports) | Real Chromium production load, inspect rendered green angled hero, cream card, OAuth buttons and QA form | No horizontal overflow, no signup, no console errors; colors/fonts correctly rendered |
| POST-SEC-01 | Guest | GET health/ready/coupons/payroll gated routes | 200/503/503/401-or-gated, no data leakage |
| POST-ROLE-01 | 2 QA Sales + 4 station owner actors | Login, inspect station directory, fuel catalog and permitted links | Role/scope correct, no price Save |
| POST-CORP-01 | 12 QA Corporate Admins | Login, inspect driver assignment, account and QR controls | Self-tenant GET 200; wrong-tenant GET 403; no QR issued |
| POST-PUMP-01 | 4 QA Cashiers | Login, open scan page without camera or scan | Authorized UI, no finance menu |
| POST-HR-01 | Existing QA HR actors | Read-only roster/review/payroll | PASS only when actual GETs and UI succeed; explicit BLOCKED for release-gated 503 |
| POST-FIN-01 | 4 station owners | Pending queue read-only | PASS if enabled and observed; BLOCKED if guarded 503 |

## Explicitly excluded from this run

Any creation/changes to QA stations, users, employees, shifts, prices, credits, debt, coupons, attendance, leave, advances, payroll drafts/lines/payouts, refunds/disputes, Stripe, real email/LINE, bank transfer, tax or payroll policy. No production API or HR QA switch activation. No deletion of any preexisting record.

## Evidence, cleanup and release gates

1. Run PR CI and public Chromium smoke on the deployed website. Report failure with exact case, not an invented PASS.
2. On green CI, merge **test-only** PR to main; wait for same-commit guarded Production Preview deployment and the protected live functional read-only workflow.
3. Record CI job links, browser outcomes, skipped/blocked tests, and post-run Cloudflare preview flags plus Supabase read-only counts in `docs/qa/runs/QA-20261103-POSTDEPLOY-READONLY-001.md`.
4. Cleanup mode: **No data created — no cleanup**. Do not infer user approved any reset.
5. This does not constitute full 236-case UAT, production payroll/financial go-live, or verification of real provider transactions.
