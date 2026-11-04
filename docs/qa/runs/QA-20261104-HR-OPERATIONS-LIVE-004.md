# QA-20261104-HR-OPERATIONS-LIVE-004 — scoped production HR activation

**Date:** 4 November 2026 (Thailand).  
**PR:** https://github.com/nsomprasong/OilStation/pull/131  
**Source:** `feature/hr-operational-release-gate-20261104`, last pre-report test commit `6613049c70903683cc5e40f5730a15c0fcb88b40`.  
**Production:** Cloudflare Worker `oilstation`, Supabase `cxihsotcpdnalswfoysx`.  
**User authorization:** Continue deployment toward genuine production use; historical owner instruction explicitly waived Backup, so no Backup claim is made.

## Scope released

- Separate `OILSTATION_HR_OPERATIONS_ENABLED` real HR lane for authenticated **non-QA** active station members; station role, station membership, app-user active status, and HR subscription enforced independently.
- Explicit GET-only Payroll readiness, policy, salary-draft list, reviewed attendance preview. All salary draft line creation/review, policy mutation, payee/bank, advance and payout endpoints remain off through the HR lane.
- Core daily HR operational requests: employees, shift templates/assignment/substitution, GPS punch and supervisor review, leave request and independent review, OT request and review. Every action retains its existing audit and scoped SQL RPC; leave results never automatically deduct salary.
- General production API flag `OILSTATION_API_ENABLED=false`, simulated finance `OILSTATION_QA_FINANCE_SIM_ENABLED=false`. Finance/coupons/Stripe/webhooks remain blocked. `/api/ready` does **not** claim full finance release.
- QA Auth users rejected from the real HR lane. No authentication bypass and no new direct browser table permission.

## Key issue discovered during preflight and corrected

`service_role` does **not** hold direct `SELECT` privilege on `public.station_modules`; an initial adapter design would have returned an error for all users. This issue was identified **before activation**. Implemented a private SQL RPC `public.hr_station_module_access(uuid,uuid)` instead, to check both the actor's active station role, active app account, and the station's enabled `hr_payroll` module. Only service_role has EXECUTE.

### Production SQL migration (already installed before Worker activation)

- File `supabase/migrations/20261104080000_hr_station_module_access.sql`; applied via Supabase migration tool with success.
- Live post-migration catalog: `SECURITY DEFINER`, empty `search_path`, `service_exec=true`, `anon_exec=false`, `authenticated_exec=false`, direct service_role `station_modules SELECT=false`.
- Read-only live check over existing eligible station memberships: **25** active user/station pairs; **19** actor+station module allowed and **6** denied. This is an authorization audit, not a count of real HR employees.
- Production had **0 real employees**, **3 QA employee records**, **2 pending attendance punches**, **8 approved but undistributed advance records**, and **0 approved wage policies**. Do not claim payroll or bank readiness.

## Executed tests

| Gate | Result | Evidence |
|---|---|---|
| Isolated PostgreSQL 16 private RPC | PASS: foreign station / disabled module / suspended app user / revoked membership denied; service role succeeds with direct table SELECT revoked; test data rolled back | [Actions #41751932982](https://github.com/nsomprasong/OilStation/actions/runs/41751932982) |
| Real HR lane authorization API tests | PASS: QA denial, no-token denial, cross-station, content-length, CSRF origin, role/entitlement, staff self leave and manager controls | [Checks #41751932798](https://github.com/nsomprasong/OilStation/actions/runs/41751932798) |
| Complete Node/API | **596/596 PASS** on pre-report source | Same Checks |
| Real public Chromium | **7/7 PASS** on pre-report source | [Actions #41751932812](https://github.com/nsomprasong/OilStation/actions/runs/41751932812) |
| All CI workflows | **13/13 PASS** on pre-report source | PR Checks |
| Production HR RPC post-migration | PASS in read-only SQL; zero new money/payroll rows | Supabase Execute SQL (read-only) |
| Authenticated live-browser HR E2E with non-QA staff | **NOT TESTED** — current database has zero genuine employee accounts; existing QA IDs intentionally denied | No such case claimed PASS |

## Data and risk register

Prior SQL financial table baseline: `payroll_periods=0`, `payroll_runs=0`, `payroll_lines=0`, `payroll_payouts=0`, `advance_repayments=0`, `bank_export_batches=0`, wallet ledger `5`, audit events `258`. SQL migration made no payroll or employee rows.

**Open blockers to full HR/Payroll financial go-live:** real first station HR actors/employees and role-invitation E2E; signed station wage/leave/OT policy, taxation/social security review; reconciliation of 2 unreviewed punches and 8 QA approved-but-undisbursed advances; bank/PromptPay provider reconciliation, approved file format and legal review; backup/recovery is still unverified (owner previously opted to skip, but risk remains).

## Post-merge evidence (fill by observed result, not assumption)

Record final merge SHA, Production Preview run, Cloudflare Worker deployment/version, actual flags and 401/503 HTTP route checks after release. Do **not** claim the Production Worker was updated until the deployment confirms success. The underlying Module RPC is live independently of the Worker toggle.
