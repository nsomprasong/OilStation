# QA-20261104-HR-ADVANCE-GUARD-001 — payroll draft SQL reconciliation guard

**Status:** ISOLATED TESTS PASS; **PRODUCTION SQL MIGRATION NOT APPLIED**.  
**Date:** 4 November 2026 (Thailand).  
**Plan:** `docs/qa/plans/2026-11-04-payroll-advance-draft-sql-guard.md`  
**Repository:** [PR #128](https://github.com/nsomprasong/OilStation/pull/128)  
**Target:** OilStation's existing Supabase `cxihsotcpdnalswfoysx`; disposable PostgreSQL 16 used for actual SQL test only.

## 1. Observed problem

Read-only production catalog verification showed that `hr_payroll_readiness_evidence` includes an `openAdvances` counter but the currently deployed `hr_create_payroll_review_line` function definition **did not** reference this counter. The synthetic QA S01-A employee has 8 unresolved advance records for November 2026, which the readiness UI blocks, but the SQL draft boundary did not independently reject. **No unapproved payroll, deduction or payout has been observed.**

## 2. Corrective change (prepared but not applied live)

Forward-only `supabase/migrations/20261104063000_hr_payroll_unreconciled_advance_draft_guard.sql` retains the previously audited attendance/punch/role/period guards and adds:
`COALESCE((v_evidence->>'openAdvances')::integer,-1)<>0`
to the same `PAYROLL_EVIDENCE_UNREVIEWED` exception **before** payroll period/run/line creation. Null/missing evidence blocks rather than turning into "ready"; existing API maps this SQL error to HTTP 409. Privileged grants remain `service_role` only, with `REVOKE` for PUBLIC/anon/authenticated.

## 3. Executed evidence

| Test | Evidence | Result |
|---|---|---|
| Disposable PostgreSQL 16 SQL compilation and execution | [GitHub Actions 41743965206](https://github.com/nsomprasong/OilStation/actions/runs/41743965206) | **PASS** |
| 8 and 1 open advances | Same isolated PostgreSQL run | **PASS:** denied before attendance/period creation |
| Missing advance counter | Same isolated PostgreSQL run | **PASS:** denied, fail closed |
| 0 open advances | Same isolated PostgreSQL run | **PASS:** reaches the next existing independent attendance gate; cannot pay |
| Zero financial writes | Same isolated PostgreSQL run | **PASS:** zero period, run, line, payout or advance repayment rows |
| Full Node/API tests | [Checks 41743965294](https://github.com/nsomprasong/OilStation/actions/runs/41743965294) | **PASS 582/582** |
| Public real Chromium smoke | [Playwright 41743965268](https://github.com/nsomprasong/OilStation/actions/runs/41743965268) | **PASS:** public-browser job; authorized business suites intentionally skipped |
| Other original PR gates | Same PR CI commit `990d4889d51ad3f43253390a88e4c02d12faf449` | All existing isolated SQL workflows and checks PASS |

First isolated test failed on an incomplete synthetic fixture: `public.app_users.id` references `auth.users.id`, and the test had omitted the corresponding fake Auth row. Only that disposable test fixture was amended; no production Auth data changed.

## 4. Independent live read-only post-test checks

- Supabase currently: `payroll_periods=0`, `payroll_runs=0`, `payroll_lines=0`, `payroll_payouts=0`, `bank_export_batches=0`, `advance_repayments=0`, `hr_station_payroll_policies=0`, `wallet_ledger=5`, `audit_events=258`, `leave_requests=2`. No live records were created by this PR's test workflow.
- Production `pg_get_functiondef` **still reports no openAdvances reference** in `hr_create_payroll_review_line`. This is expected until the forward-only migration receives a separate authorized production DB rollout and post-migration verification.
- This patch does not arm Cloudflare HR/finance QA, run a payout API, approve statutory rules, or alter the actual employee advances.

## 5. Verdict and next gate

**PASS:** New SQL guard tested in disposable PostgreSQL and all Node/browser checks.  
**BLOCKED / not yet released:** Production DB function not updated, no authenticated Payroll draft/review E2E, no verified recovery drill, no real wage/tax/SSO/legal approval. A guarded Worker deployment after merge **does not apply Supabase SQL migrations**.

**Next:** review controlled migration rollout, compare production function to the last known safe migration, apply with recorded change authorization and verify catalog/privileges/row counts. Only then can synthetic QA test the actual draft and independent review without opening any bank transfer.
