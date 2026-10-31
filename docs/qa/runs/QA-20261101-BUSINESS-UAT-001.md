# OilStation — Actual QA Business End-to-End UAT

**Run ID:** `QA-20261101-BUSINESS-UAT-001`  
**Executed:** 31 Oct–1 Nov 2026 (Thailand time, UTC+7)  
**Target:** `https://oilstation.goldensoft.cloud`, existing Supabase project `cxihsotcpdnalswfoysx`  
**Fixed fixture:** QA-S01-A, QA-S01-B, QA-S02-A, QA-S02-B; 12 QA company relationships; protected previously provisioned QA actors  
**Owner direction:** Execute business functionality directly using GitHub Actions; open access to test.  
**Actual release approach:** Scoped, expiring QA-only access. No broad production API activation, no real bank/Stripe, real email, fuel dispenser, or payroll payout.  
**Source master plan:** `docs/qa/plans/2026-10-31-oilstation-master-uat.md`.

## Authoritative execution record

| Workflow/PR | Actual observed outcome |
|---|---|
| [PR #70](https://github.com/nsomprasong/OilStation/pull/70), [live run 41224107052](https://github.com/nsomprasong/OilStation/actions/runs/41224107052) | PASS: existing QA Corporate Admin requested simulated 100 THB credit; separate QA station owner approved; no pre-approval credit, replay did not double-credit. Issued signed QA coupon reserving 50 THB; driver QR appeared in own inbox and station operator scan inspected it successfully. HR test blocked by outdated test field `templates` vs `shiftTemplates`. Always-run disarm SUCCESS. |
| [PR #71](https://github.com/nsomprasong/OilStation/pull/71), [live run 41224574047](https://github.com/nsomprasong/OilStation/actions/runs/41224574047) | Three stations' HR employees, templates and shift assignments passed actual browser/API; fourth intentionally QR-only station denied HR seed (initial test treated as failure). Finance simulation remained OFF; disarm SUCCESS. |
| [PR #72](https://github.com/nsomprasong/OilStation/pull/72), [live run 41225207001](https://github.com/nsomprasong/OilStation/actions/runs/41225207001) | Full HR entitlement test PASS: S01-A, S01-B, S02-A created or reloaded existing fictional employees/shift schedules; S02-B `hr_payroll=disabled` denied writes. Browser 1 PASS, 1 intentionally skipped finance; arm/test/disarm all SUCCESS. |
| [PR #73](https://github.com/nsomprasong/OilStation/pull/73), [live run 41225738295](https://github.com/nsomprasong/OilStation/actions/runs/41225738295) | PASS: QA HR user submitted 60-minute OT request, independent station owner approved 45 minutes (`partial`), repeat approval replay-protected; QA shift substitution request reviewed and approved independently, original shift marked `replaced`, repeat review replay-protected; payroll preview remained `payable=false`, no wage payout. HR station entitlement regression PASS. Browser 2 PASS, finance test intentionally skipped; all three jobs (arm/test/disarm) SUCCESS. |

All four PRs passed the regular 12/12 GitHub Actions PR checks before merge to main. Production Preview deployment checks stayed in the guarded `OILSTATION_API_ENABLED=false` state.

## Independent final QA-only database measurements

Measured with read-only SQL against the existing Supabase project after the last UAT teardown. Counts below are scoped to exactly the four fixed QA stations/12 QA corporate-station accounts.

| Item | Before business UAT | Final verified |
|---|---:|---:|
| QA stations | 4 | 4 |
| QA corporate-station accounts | 12 | 12 |
| Synthetic top-up requests | 0 | 1 |
| Approved synthetic amount | 0 | 10,000 satang (100 THB) |
| QA wallet ledger synthetic top-up entries | 0 | 1 |
| Real bank top-up requests in these QA accounts | 0 | 0 |
| QR coupons | 0 | 1 |
| Total maximum amount of active reserved QA coupons | 0 | 5,000 satang (50 THB) |
| QA HR employees | 0 | 3 |
| QA shift templates | 0 | 9 |
| QA shift assignments | 0 | 4 (3 initial + 1 replacement) |
| QA overtime requests | 0 | 1 (`partial`, 45 minutes approved of 60) |
| QA substitute shift requests | 0 | 1 (`approved`) |
| QA fuel sessions | 0 | 0 |

For the fictional `QA-S01-A-C01` account at `QA-S01-A`, independent read-only SQL confirmed `prepaid_balance_satang=10000`, `reserved_satang=5000`, `debt_outstanding_satang=0`, and exactly one QA coupon. Available unreserved prepaid = 50 THB. The coupon remains **reserved** and is **not** proof of completed fueling or actual fuel delivery.

## Guards and deployment outcome

- Each UAT run operated on the four fixed QA stations and 12 approved QA corporations, with Supabase Auth `app_metadata` QA identity validation and scoped membership authorization.
- Finance UAT was run only once, through a dedicated synthetic-credit path. The follow-on HR runs intentionally left finance simulation OFF so they could not accidentally add another 100 THB or issue another QR.
- The temporary QA Worker binding included an expiry and an `always()` redeployment job. Each completed UAT workflow confirmed the **disarm job SUCCESS**, restoring its default disabled finance/HR flags. Normal `OILSTATION_API_ENABLED=false` was preserved throughout.
- No genuine bank transfer, bank slip submission, Stripe charge, LINE message, real dispenser action or salary payout was attempted.
- Existing synthetic fixtures intentionally retained with ledger/audit records. **No cleanup/reset** was requested or carried out.
- An independent verified full-production backup/recovery drill was **not** completed. The live run was constrained to synthetic QA records and non-financial HR operations.

## What is NOT proved — do not mark project-wide PASS

1. **Fueling end-to-end NOT TESTED:** coupon was issued, reserved, delivered to driver and inspected by station only. Manual authorized reviewer inspection of original plate/pump/receipt photos, pump price lock, real fueling start/finish, final wallet settlement and unused hold release remain unverified.
2. **GPS, face/manual evidence and approved attendance-to-payroll NOT TESTED:** no device GPS punches or verified face/evidence were entered. Preview explicitly not payable; statutory OT rules, payslip/bank export and payroll close not approved for real payout.
3. **Real financial providers BLOCKED/NOT TESTED:** live bank settlement/receipt verification, Stripe processing/webhook actual reconciliation, and LINE/email delivery remain outside synthetic QA and not production-authorized.
4. **Master 236-case UAT catalog NOT COMPLETED**. Prior separate runs verified all 98 required QA identity scopes (Support01 deliberately excluded by owner's earlier instruction), read-only menus/API and fixed driver vehicle assignments, but not all transaction branches, concurrency/photo cases, AR invoices, billing/cross-station migrations or recovery scenarios.
5. **Minor UX contract gap:** HR menu can be shown for a role at QR-only station even when station entitlement disables HR; server-side denial is correct but UI should hide/disable the function with a clear entitlement message. The denied HR seed is surfaced as generic 503 rather than a clear 403/plan-required status.

## Verdict

**PASS for the executed, explicitly described scoped QA flows**: simulated wallet top-up and reservation, driver/station QR checks, HR employee/shift provisioning, cross-tenant denial, OT partial approval, shift substitution and nonpayable payroll preview; automatic disarm and QA data integrity verified.

**BLOCKED / NOT TESTED for complete customer-facing fueling, evidence review, GPS-attendance-to-payroll, real payment integrations and the entire 236-case master catalog.** No claim of universal production readiness or end-to-end completion for unexecuted features. Next UAT should use explicitly fictional photos and an independently reviewing human or verified dedicated test-data isolation; do not manufacture image evidence or silently open live finance.
