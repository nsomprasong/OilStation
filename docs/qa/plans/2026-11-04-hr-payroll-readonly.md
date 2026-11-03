# QA-20261104-HR-PAYROLL-READONLY-001 — OT → attendance → payroll guard continuation

**Status:** APPROVED — existing owner instruction to continue QA; read-only / isolated synthetic tests only.  
**Target:** Existing OilStation project `cxihsotcpdnalswfoysx`; current Cloudflare production-preview app `oilstation.goldensoft.cloud`. No staging; **no writes on production Supabase**.  
**Previous checkpoint:** PR #126 corrected QA Leave disarm and deployed on main. Live fictional leave requests: one approved, one rejected; never converted into a payroll deduction or payout.

## Exact scope

1. Query **read-only, permission-scoped** `public.hr_payroll_readiness_evidence` through Supabase on existing QA employees in stations `QA-S01-A`, `QA-S01-B`, `QA-S02-A`; check November 2026 plus December 2026 for the already-reviewed QA leave. Suppress employee names, wages, full account values and identity secrets from evidence.
2. Preserve the observed aggregate fixture as regression checks in isolated `node --test`: approved OT and reviewed/pending attendance, approved leave, advance reconciliation, primary payee, wage policy, statutory review, `payable=false` and `postedSatang=0`.
3. Exercise the pure `buildPayrollReview` scenario model with manually reviewed fictional OT (including partial approval), one reviewed shift, pending OT exclusion, approved-but-not-disbursed advance, and deny unreviewed punch; ensure no payout path exists.
4. Rerun GitHub PR CI and public Chromium E2E. No authenticated live finance/HR POST, no new leave or shift, no real payments.

## Read-only observed baseline (2026-11-04)

| QA employee (fictional code) | Period | Approved OT | Punches/unreviewed | Shifts | Open advances | Approved primary payee | Approved leave | Policy/statutory |
|---|---|---:|---:|---:|---:|---:|---:|---|
| QA261101S01A | Nov 2026 | 13 | 6 / 2 | 12 | 8 | 1 | 0 | false / false |
| QA261101S01B | Nov 2026 | 0 | 0 / 0 | 1 | 0 | 0 | 0 | false / false |
| QA261101S02A | Nov 2026 | 0 | 0 / 0 | 1 | 0 | 0 | 0 | false / false |
| QA261101S01A | Dec 2026 | 0 | 0 / 0 | 0 | 8 | 1 | 1 | false / false |

The existing RPC returned `payable=false` and `postedSatang=0` in all four scoped reads. This is a fixed **regression fixture snapshot**, not a perpetual claim about live counts. Future QA changes must update this documented baseline only after independently measured evidence.

## Explicit release gates

- Real payroll period close, policy proposal/approval, draft or review writes, employee leave/advance mutations, bank exports, PromptPay, Stripe, finance, coupon issuance, audit writes or cleanup are **excluded**.
- No production SQL migrations, no creation of Supabase branches, no new Cloudflare business flags. A verified backup/recovery drill was not available; therefore no live mutation in this run.
- Isolated scenario engine may report `ready_for_review` but never `payable=true`; that is not production approval and cannot substitute for legal wage/OT/leave/tax policy review.
- Post CI, verify protected preview flags unchanged and database `payroll_runs`, `payroll_lines`, `payroll_payouts`, and `bank_export_batches` still zero.
- Store actual outcomes in `docs/qa/runs/QA-20261104-HR-PAYROLL-READONLY-001.md`; report any blocked gaps as BLOCKED, not PASS.
