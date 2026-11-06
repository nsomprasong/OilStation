# OilStation — TEST-6-005 — six new guarded Master UAT acceptance checks

**2026-11-06 | Canonical UAT:** `docs/qa/scenarios/oilstation-master-236-evidence-crosswalk.json` (reordered after completed 001–004, never rerun previously successful cases). This is a bounded new **six-case** protected Chromium batch 063–068, **one** guarded Preview deploy. No staging environment. Does not enable production financial operations or payroll.

## New cases and exact scope

| QA case | Master ID | Actor | New acceptance and expected result |
|---|---|---|---|
| 063 | S-02-R | s01b-cashier | Same-station station_owner invitation rejected 403; no invitation created |
| 064 | S-09-V | s01b-owner | Fourth fixture company `QA-S01-B-C04` rejected 400 `qa_fixture_only`; own account list retains 3 |
| 065 | S-09-R | s01b-owner | Valid-shape request targeting foreign QA-S02-A company slot rejected 403 `scope_not_owned`; own overview unchanged |
| 066 | C-04-R | c01-driver | Company driver cannot invite corporate finance_manager; 403, no invited account |
| 067 | X-01-R | s01b-owner | Public runtime config and browser localStorage expose no privileged Supabase service key or payment private key |
| 068 | X-07-R | c01-accountant | Unauthenticated activity GET 401; corporate actor cannot read Sales audit activity GET 403 |

## Preflight and safety evidence

- Before this PR, read-only production DB aggregate: **invitations 2; corporate companies 12; station links 12; audit 260; memberships 100; coupons 2; payroll runs 0**.
- Reviewed SQL `create_scoped_invitation`: a station cashier is not among invitation approvers, and a corporate driver is not a corporate_admin. Both throw `FORBIDDEN` **before INSERT**. No automatic email actions.
- `/api/station/customers` QA-only preview enforces **three fixed company slots** before calling SQL and requires exact station_owner membership for the requested station. Other company creation is denied.
- `platform_sales_activity_history` SQL checks platform Sales assignment / Super Admin membership **before** selecting events; corporate accountant is denied.
- Test assertions send no accepted business writes; accepted invitation/company creation would cause this suite to FAIL and stop. Independent database counts must match the original preflight.
- No new QA users, no third Sales, no fifth QA station, no 13th company, no QR issue, fuel settle, Stripe, HR, payroll or bank writes.
- Matching SHA guarded Preview success is required before protected serial Chromium starts; 12/12 PR CI required before squash merge. **Only new e2e files 063–068** are selected. No previous PASS case rerun.

## Status ledger

**Before execution:** NOT RUN. Do not report PASS merely from an authored spec or CI; update this run in PR comments after actual six-case Chromium and DB read-only verification. Other queue acceptance cases (OAuth, plan selection/price or HR) remain pending or blocked by the lack of safe fixture; they are reordered, not silently dropped.
