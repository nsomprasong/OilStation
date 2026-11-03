# OilStation — QA-20261104-HR-PAYROLL-READONLY-001: live evidence + isolated review-only regression

**Executed:** 4 November 2026 (Thailand)  
**Plan:** `docs/qa/plans/2026-11-04-hr-payroll-readonly.md`  
**Target:** Existing Supabase OilStation project `cxihsotcpdnalswfoysx` and Cloudflare guarded production preview.  
**PR:** [#127](https://github.com/nsomprasong/OilStation/pull/127)  
**Safety:** This run made **no Supabase writes**, did not enable any HR/finance QA worker switch, did not approve legal payroll policy, and did not trigger payouts or exports.

## 1. Evidence from actual production-backed Supabase — read-only SQL

A trusted read-only SQL query selected only synthetic QA employee codes with matching station-owner scope, then called the existing `public.hr_payroll_readiness_evidence` function for the November 2026 period. Only aggregate status/counter fields were returned to the report (not identities, wages, account numbers, or JWTs).

| QA station/employee | Period | Approved OT | Punches / not reviewed | Scheduled shifts | Open advances | Approved primary payee | Approved leave | Reviewed policy/statutory |
|---|---|---:|---:|---:|---:|---:|---:|---|
| QA-S01-A / QA261101S01A | Nov 2026 | 13 | 6 / 2 | 12 | 8 | 1 | 0 | No / No |
| QA-S01-B / QA261101S01B | Nov 2026 | 0 | 0 / 0 | 1 | 0 | 0 | 0 | No / No |
| QA-S02-A / QA261101S02A | Nov 2026 | 0 | 0 / 0 | 1 | 0 | 0 | 0 | No / No |
| QA-S01-A / QA261101S01A | Dec 2026 | 0 | 0 / 0 | 0 | 8 | 1 | 1 | No / No |

Every scoped RPC responded with `payable=false` and `postedSatang=0`. December approved annual leave remains unpriced, and pending advance reconciliation is not an automatic deduction. No approved wage/leave or tax/social-security policies were present.

**Independent safety snapshot:** `payroll_periods=0`, `payroll_runs=0`, `payroll_lines=0`, `payroll_payouts=0`, `bank_export_batches=0`, `advance_repayments=0`, `hr_station_payroll_policies=0`, `wallet_ledger=5`, `audit_events=258`, `leave_requests=2`, `overtime_requests=13`, `attendance_events=6`. The two retained test leaves belong to prior approved `QA-20261103-HR-LEAVE-001`; this run added none.

## 2. Regression on disposable CI runners (no production DB connection)

Added six deterministic test cases under `test/qa/hr-payroll-live-blocker-fixture.test.mjs` to preserve the sanitized snapshot's expected **BLOCKED** states and the review-only OT payroll logic.

| ID | Fixture outcome | Result |
|---|---|---|
| S01-A Nov | Approved OT, unreviewed attendance, unsettled advances, missing policies | PASS: readiness blocks |
| S01-B/S02-A Nov | No attendance, no approved primary payee, no reviewed policies | PASS: readiness blocks |
| S01-A Dec | Approved leave does not auto-compute paid entitlement or deduction | PASS: readiness blocks |
| Pure review model | One reviewed daily shift, 45 of 60 OT minutes approved, pending OT excluded, approved but not disbursed advance ignored | PASS: `ready_for_review` and `payable=false` |
| Unreviewed punch | Payroll model fails closed | PASS: `unreviewed_attendance_or_leave` |
| Malicious/invalid safety flags | `payable=true`, `readOnly=false`, posted money or contradictory counters | PASS: rejected |

**Initial CI failure repaired:** The new test initially asserted the wrong issue identifier (`unreviewed_attendance` instead of the existing `unreviewed_attendance_or_leave`). This was a **test expectation defect**, not a payroll engine bug. Corrected in commit `4820e2489223860bf80e7b677930e1c07fc5d71c`.

Final verified CI for corrected commit: **12/12 GitHub workflows successful**, including [Checks](https://github.com/nsomprasong/OilStation/actions/runs/41742227933): **580/580 Node unit tests passed**, and [Public Chromium](https://github.com/nsomprasong/OilStation/actions/runs/41742227982): **7/7 browser tests passed**. Protected authenticated HR writes and actual payroll payout were intentionally **not** run.

## 3. Decision, cleanup and outstanding gaps

- **PASS:** safely observed November/December payroll blockers on actual QA employee records, regression guards, isolated pure OT arithmetic, and public Chromium.
- **BLOCKED / NOT TESTED:** actual payroll draft and independent approval on live QA, approved wage policy and statutory inputs, complete attendance review, shift-to-payslip settlement, payroll lock/export/bank transfer, PromptPay payout, actual tax/SSO and legal entitlements. Those require approved production change/QA safety plan with verified recovery before mutating the shared DB.
- **Cleanup:** no new objects created, so none deleted. Historical test leaves and append-only audit remain intact.
- **Release:** `OILSTATION_API_ENABLED=false` and `OILSTATION_QA_FINANCE_SIM_ENABLED=false`; no authorization for real money processing.

**Next practical step:** review and reconcile synthetic QA pending attendance and advances, obtain station-specific documented wage/leave rules and verified backup/rollback capability, then separately authorize a bounded Payroll draft/review E2E. Do not enable live payroll payments merely because the review-only tests passed.
