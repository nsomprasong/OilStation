# OilStation — QA-20261103-HR-LEAVE-001: independently reviewed fictional leave

**Status:** IN PROGRESS, continuation of the owner's bounded QA instructions. **Date:** 2026-11-03.
**App:** https://oilstation.goldensoft.cloud; **database:** the existing Supabase project `cxihsotcpdnalswfoysx` (no staging).
**Browser:** protected `oilstation-qa` GitHub Actions Chromium with existing Sales01-derived `s01a-hr`, `s01a-owner`, and `s01b-hr` QA accounts.
**Why now:** Last verified 98/98 role logins (PR #120); remaining HR UAT only confirmed leave UI, not actual request/independent review.

## Scope / expected outcomes

| Case | Actor | Browser/API operation | Expected UI/API/DB |
|---|---|---|---|
| LEAVE-01 | S01-A HR | Login, choose existing fictitious employee code `QA261101S01A`, request synthetic annual leave for **2026-12-24** with run-tagged reason | UI pending and precisely one DB `leave_requests` record, zero wage posting |
| LEAVE-02 | S01-A HR, S01-B HR | Attempt self-approval and cross-station list of the request | 403 denial and no audit from the failed actions |
| LEAVE-03 | S01-A HR | Request overlapping period and past date | 409 and 400, no new leave row |
| LEAVE-04 | S01-A Owner | Independent browser review of the first request, read result and replay via API | Approved once, repeat reported replay, no duplicate audit |
| LEAVE-05 | S01-A HR, S01-A Owner | Request one **2026-12-28** synthetic sick-leave day and have different owner reject | Rejected row; no automatic attendance change, wage deduction or payroll payout |
| LEAVE-06 | All relevant | Reopen/reload leave list and verify final state; anonymous / cross-tenant denials | Visible approved/rejected records, error/ACL correctness, no issue outside QA station |

**Exact permitted mutations:** at most **two** records in `public.leave_requests` for one previously created QA employee and expected append-only **four** `public.audit_events` (two requests and two reviews). IDs are generated server-side, enumerated and retained in this run's report. These are fictional leave records, not employee payouts or policy approval. On retry with the same tagged reasons the browser test **fails before new writes** to avoid duplication.

**No other authorized mutations:** no bank/PromptPay/Stripe, no actual top-up/credit, no QR/fueling, no new employees/shift assignments, no salary advances, no real email/LINE, no payroll drafts/lines/payouts, no actual wage policy or legal entitlement; no deletion or system reset.

## Preflight baseline (read-only on 2026-11-03)

- Existing QA target employee by code: **1**.
- `leave_requests=0`, `payroll_runs=0`, `payroll_lines=0`, `payroll_payouts=0`.
- `wallet_ledger=5`, `audit_events=254`, `hr_station_payroll_policies=0`, `saas_invoices=1`, `fuel_sessions=2`.
- Cloudflare Worker currently `OILSTATION_DEPLOY_TARGET=production`, `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`, `OILSTATION_QA_HR_UAT_ENABLED` absent/disabled.
- **Independent recovery drill is NOT VERIFIED**. This test performs no destructive operation; synthetic append-only audit/leave evidence remains until an explicit ID-specific cleanup/reset approval.

## Execution gates

1. PR CI must pass; merge to `main` through approved branch workflow.
2. On main only, production environment arms scoped HR QA (exact 4 fixed stations; fixed 12 company accounts), bounded by 45-minute expiry; **finance stays off** and `/api/ready` remains 503.
3. Single-job Playwright Chromium test with two allowed station identities and one negative cross-station identity; no browser tokens/screenshots/video uploaded.
4. Always-run teardown redeploys default `wrangler.jsonc` to disable all QA HR/write switches even on browser failures.
5. Post-run independent Supabase read-only SQL records exact IDs by run-tagged reason, expected two statuses and audit counts; check payroll/bank/finance baseline unchanged. Verify Cloudflare API flags and same-commit deploy.
6. Record results in `docs/qa/runs/QA-20261103-HR-LEAVE-001.md`; never mark PASS without executed browser + authoritative DB evidence.

## Cleanup / remaining UAT

**TEST_ONLY retained, no cleanup automatically.** Leave and audit records must not be deleted just to reach expected counts; enumerate exact IDs for separately approved cleanup. Continue full real payroll + leave-entitlement statutory review only after approved policies and a separately proven recovery route.
