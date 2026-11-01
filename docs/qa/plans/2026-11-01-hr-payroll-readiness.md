# QA-20261101-HR-PAYROLL-READINESS-001

## Scope and guardrails
Production project: `cxihsotcpdnalswfoysx`; GitHub `nsomprasong/OilStation`; Cloudflare Worker `oilstation`.
This change targets **review-only** payroll scenario arithmetic and a simpler, read-only attendance review flow. It does not activate general production API, issue payroll payout, write bank export, or change ledger/employee financial data.

## Existing evidence
- Live QA role scope: 4 owned QA stations and 12 QA companies.
- Live browser HR OT/replacement and linked GPS tests completed successfully, with disarm checked.
- Database contains leave_requests, salary_advances, payroll_runs, payroll_lines, payroll_payouts but no deployed end-to-end request/approval/payout APIs for these.
- Current Payroll UI calls only `/api/hr/attendance/payroll-preview`, which must return `payable=false` and `faceVerified=false`.

## Planned tests (synthetic, no data mutation)
1. Monthly, daily and hourly salaries use integer satang, no floating point loss; month with approved paid leave, unpaid leave, reviewed absence.
2. Late/unreviewed punch is blocked, not automatically treated as absence or a deductible wage.
3. Planned OT, retrospectively approved OT, partial approval, rejected OT, pending OT excluded from gross.
4. Substitution counts one paid shift per date for daily salary, multiple shifts count hours only once per actual time block; blocks overlapping stamps.
5. Salary advance request/approval is not a wage deduction until marked paid; authorized repayment is capped by outstanding balance and explicit deduction authorization.
6. Taxes and social security require reviewed inputs; no statutory rates are guessed.
7. Monthly prorating uses an explicitly configured divisor; non-working holiday or paid leave is not silently deducted.
8. Review-only result is never payable; payout requires separate bank/PromptPay validation, payee verification, period lock, dual approval and reconciliation.

## Owner-requested follow-on production scope, NOT yet implemented
- Employee submit future leave request, manager approve/reject, calendar conflict, paid/unpaid rules, entitlement/carryover.
- Employee advance request, independent manager approval, actual payout evidence, repayment schedule and caps.
- Freeze payroll inputs, draft/review/approve/lock, correct prior-period adjustment and double-payment prevention.
- Manual/bank/PromptPay exports with payee verification, idempotent settlement and reconciled paid/failed status.
- Authorized Live E2E over each station/role, approved holidays/OT rates, leave and wage policy, regulatory review, backup/rollback.

## Release/rollback
Before any merge, run all GitHub CI workflows and scan for regressions. Merge only PASS, deploy production preview with finance/HR QA switches closed and verify Cloudflare bindings. A passing synthetic scenario suite does **not** confer production payroll release approval or permission to transfer real wages.
