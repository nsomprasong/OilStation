# QA-20261104-HR-ADVANCE-GUARD-001 — direct Payroll Draft SQL gate

**Status:** Scoped continuation of approved OilStation HR testing; no live DB write authorized in this run.  
**App/DB:** `oilstation.goldensoft.cloud`, existing `cxihsotcpdnalswfoysx`.  
**Repository:** `nsomprasong/OilStation`, plan for PR #128.

## Problem found

The production database's `public.hr_payroll_readiness_evidence` returns `openAdvances` (8 for the fixed fictional QA S01-A employee in the November period), causing the review-only UI to block payout. However a read-only introspection of `pg_get_functiondef` proved `hr_create_payroll_review_line` has no direct `openAdvances` guard. A trusted client with an otherwise valid attendance/policy/payee could create a review draft while advances still await reconciliation. No payout occurred; business API remains guarded off.

## Authorized change and test scope

- Add **forward-only** SQL function migration `20261104063000_hr_payroll_unreconciled_advance_draft_guard.sql`, derived from the last checked-in human-reviewed attendance-provenance implementation.
- Before any payroll period/run/line INSERT, require a present integer `openAdvances=0`; missing or nonzero evidence fails closed with existing `PAYROLL_EVIDENCE_UNREVIEWED` (HTTP 409). No new API or role grants.
- Add a dedicated **disposable PostgreSQL 16** GitHub Actions suite against the source's metadata-only public schema: 8 open, 1 open, missing field => blocked before attendance; 0 => reaches the existing attendance provenance gate. Assert zero payout, repayment, payroll line/run/period rows.
- Add API / migration source guards in normal unit CI. Existing public browser smoke only; no production payroll POST, no QA HR arm, no real bank, no customer/user fixture, no sending, no cleanup.
- **Rollout:** merge only after full PR gates. The code/repository and guarded frontend may be merged/deployed without enabling business APIs. **Do not apply this SQL function to production DB without separate controlled authorization and compatibility verification**; the historical live function remains unchanged until migrated. This QA round does not confer actual wage/OT/statutory approval.

## Baseline and expected cleanup

Read-only live baseline: payroll periods/runs/lines/payouts, bank exports, advance repayment ledger and payroll policies all **0**, wallet ledger **5**, audit events **258**, retained fictional leave requests **2**. No test-owned live records created, so cleanup is not applicable. Full recovery drill has not been verified; no destructive changes permitted.

## Acceptance

SQL runtime test PASS, normal Node test and public Chromium PASS, all existing GitHub PR CI green. Reconfirm Cloudflare locked flags, DB counts, and explicit unapplied/applied migration state before claiming the production SQL bug is fixed.
