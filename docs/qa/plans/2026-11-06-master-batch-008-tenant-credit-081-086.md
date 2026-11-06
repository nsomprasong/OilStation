# OilStation — TEST-6-008: six new tenant-scoped auth and credit cases

2026-11-06; existing guarded Preview, same production Supabase, six new protected Master Playwright cases 081–086. NO new corporate, station, member, invitation or positive financial transactions.

| QA # | Master | Actor(s) | Acceptance and exclusions |
|---|---|---|---|
| 081 | S-01-H | QA station owners s01a, s01b, s02a, s02b | Four separate actual owner sessions see their own fuel catalog and cannot view S01A from another actor (403). Single-user multistation switching remains separately unproven. |
| 082 | S-02-V | s02b-owner | Invalid short and well-formed nonexistent invite tokens rejected 400; before/after station member directory same. A deliberately expired real token requires a separately isolated fixture. |
| 083 | S-14-R | s02a-owner | Own credit accounts 200 / foreign S01B station's credit overview 403; full ledger direct-read ACL separately audited later. |
| 084 | C-02-R | c01-admin | Company receives only its approved QA-S01-A corporate account; unrelated station credit overview 403, no unintended link. |
| 085 | C-07-V | s02b-owner | Three existing QA station company credit cards show actual zero available/prepaid/terms/debt/reservations/pending values; genuine overdraft requires approved synthetic fixture. |
| 086 | C-07-F | s01a-owner | Existing synthetic nonzero S01A prepaid credit (2,820 satang across 3 companies): 6 per-company values match authenticated server, remain consistent after full browser reload/login session recovery. |

## Preflight

Read-only Supabase baseline: QA stations 4, corporate station links 12, invitations 2, memberships 100, audit 260, coupons 2, payroll runs 0, total prepaid 2,820 satang, debt 0, reserved 0. Verify exact same after run. No raw transaction identities/passwords logged.

- Every 4-station role is independently authenticated through the existing QA-only login and /api/me, no extra roles assigned; fake invite token cannot match existing secret token.
- All other requests use read-only scoped GET or deliberately rejected fake input; no real write is permitted. One guarded Preview only after PR CI 12/12 and protected serial Chromium six-cases.
- Master IDs are recorded as bounded evidence; no false PASS for universal station switching, *actually expired* invite token, bank ledger, or blocked true overdraft.
- Positive Checkout CASE-020, real bank, payroll and Stripe remain closed. No automatic fixture cleanup.
