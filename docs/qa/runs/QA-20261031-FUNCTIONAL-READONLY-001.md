# OilStation — Actual Browser Functional QA (read-only, live preview)

**QA_RUN_ID:** `QA-20261031-FUNCTIONAL-READONLY-001`
**Date:** 2026-10-31, Asia/Bangkok
**Target:** https://oilstation.goldensoft.cloud (current shared production-preview Supabase: `cxihsotcpdnalswfoysx`)
**Plan:** `docs/qa/plans/2026-10-31-oilstation-master-uat.md` / exact frozen four-station, twelve-company QA fixture
**Operator:** ChatGPT coordinating protected GitHub Actions Chromium
**CI / code:** PR #67, commit `15e1f3323fcf267e06585c98ccfed932c2712bd1`
**GitHub Actions live browser:** https://github.com/nsomprasong/OilStation/actions/runs/41221316214
**Corresponding same-commit guarded Cloudflare deployment:** https://github.com/nsomprasong/OilStation/actions/runs/41221316315 (SUCCESS)
**Backup/recovery verification for data writes:** NOT VERIFIED; therefore this run deliberately had NO business writes or financial mutations.

## Before-run verified baseline

SQL read-only on the current Supabase project (QA station IDs only):

| QA inventory | Count |
|---|---:|
| Fixed QA stations | 4 |
| Corporate station accounts | 12 |
| Enabled and positively priced fuel products | 8 |
| Existing QA coupon rows | 0 |
| Existing QA simulated top-ups | 0 |
| QA employees | 0 |
| QA shift assignments | 0 |

Other previous QA evidence (separate completed workflows): all 98 QA roles passed authenticated, role-scoped browser checks; 12 QA vehicles assigned to 12 QA company drivers.

## Browser executed actions and results

| Test | Actual live browser and API actions | Result |
|---|---|---|
| FUN-00 | Public configuration verified QA finance simulation is OFF; no QR writes | PASS |
| FUN-01 | Sales01 and Sales02 separately signed into deployed site; each opened own station directory, saw exactly 2 stations, viewed Sales workspace and authenticated reporting GET | PASS (2/2 Sales) |
| FUN-02 | Four real QA station owners signed in, opened own fuel catalog (GET), verified at least two enabled-priced fuels and row count, opened a live fuel price editor; did NOT save | PASS (4/4 stations) |
| FUN-03 | Twelve QA Corporate Admins independently signed in, loaded own station accounts (GET), switched real 'Driver' contextual tab, verified assigned driver selector, opened QR issuance form (no submission), checked foreign company driver roster returns HTTP 403 | PASS (12/12 companies) |
| FUN-04 | Four QA cashier identities opened the actual Pump/Scan workspace; verified Finance menu denied, did not scan/redeem real QR or start fueling | PASS (4/4 stations) |
| FUN-05 | HR Manager logged in and opened actual HR workspace; authenticated GET `/api/hr/roster` returned HTTP 503, so employee/approval/payroll backend verification cannot proceed | BLOCKED — production preview release gate |
| FUN-06 | Station Owner logged in and opened live Finance workspace; refreshed pending queue but backend endpoint `/api/topup/pending` was not enabled and UI did not show an empty-state result | BLOCKED — production preview release gate |

Original real browser result was **5 PASS / 2 FAIL at HTTP/UX level**, not 7 PASS. Root-cause code review shows the two failing requests are intentionally routed to `503 {"error":"release_not_enabled"}`, because `wrangler.jsonc` pins `OILSTATION_API_ENABLED=false`. The Production Preview deployment explicitly asserts disabled finance, tests `/api/ready` -> 503 and never releases business finance automatically. They are **BLOCKED**, not proven functional defects in underlying HR or financial RPCs.

The follow-up Playwright assertion (test-only) recognizes this exact error and marks such scenarios `SKIPPED/BLOCKED`, while other unexpected errors continue to FAIL. This does not turn untested functionality into PASS.

## After-run database invariants (independent SQL)

| QA inventory | Before | After |
|---|---:|---:|
| Fixed stations | 4 | 4 |
| Enabled fuel products | 8 | 8 |
| Corporate accounts | 12 | 12 |
| Synthetic top-ups | 0 | 0 |
| Coupons | 0 | 0 |
| QA employees | 0 | 0 |

No business writes, bank payments, Stripe transactions, real emails/LINE, payroll pay-outs, coupon issuing, QR redemption or pump settlements attempted. Existing QA fixtures remain, and no deletion/reset was performed or approved.

## Blockers and follow-up gates

1. HR: current guarded Production Preview allows synthetic QA login and certain fuel/company endpoints, but not `/api/hr/roster` or HR review/payroll routes. Need separate security-reviewed, scoped QA authorization or separately approved full production release before end-to-end HR data mutations.
2. Finance: normal top-up pending is deliberately unavailable under `OILSTATION_API_ENABLED=false`. Do not enable actual banking or business finance to satisfy QA. QA synthetic finance also requires an independent opt-in finance-simulation gate and prior verification.
3. QR, real top-up, GPS punch/OT/shifts and payroll calculation were **NOT TESTED end-to-end in this run**. Merely displaying forms is not evidence that those transactions work.
4. Support01 remains **SKIPPED_BY_OWNER** under the master plan. No reset/cleanup authorization or verified recoverability for destructive tests was obtained.

**Final acceptance for read-only supported preview workflows:** PASS.
**Final acceptance for complete transaction and HR/finance workflows:** BLOCKED / NOT TESTED.
**Production GO/NO-GO:** NOT APPROVED by this QA.
