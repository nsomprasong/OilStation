# OS-QA-ST-CUSTOMER-CREDIT-003 — one actor, one Station customer-credit task

**Authorized purpose:** continue the user's OilStation full UAT without duplicating completed cases. Read-only now; eventual controlled Production release remains separately gated.

## One case only
- Fixed synthetic QA identity `s01b-owner`, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- 390 × 844 mobile; Home → **ลูกค้าบริษัท** → **เครดิตลูกค้า** task ONLY.
- Backend GET `/api/station/customer-overview?stationId=<s01b>` and refresh. Verify result has exactly 3 existing linked corporate accounts and the visible account-card count equals result length. Compare each card's **available, prepaid, term credit, outstanding debt, held coupon, pending topup** to API values by a safe money formatter. Do not log names or amounts.
- Verify one active functional pane after DOM settles, no backend/API writes or JS crash, and report unchanged authoritative database counts after run.
- No new records; **do not test** Report tab or other Company/Station/Platform menus (already covered separately).

## Baseline read-only SQL
- Supabase `cxihsotcpdnalswfoysx`: 5 stations, 12 companies, 12 linked accounts, 5 wallet ledger entries, 2 fuel sessions, 0 payroll runs and payouts, 258 audit events.
- Exactly **3 corporate_station_accounts** linked to station s01b; existing data must not be mutated.
- The preceding case `OS-QA-ST-CUSTOMER-REPORT-002` has PASSED with Browser run [41987875581](https://github.com/nsomprasong/OilStation/actions/runs/41987875581) and documented report in `docs/qa/runs/OS-QA-ST-CUSTOMER-REPORT-002.md`. NEVER run that case again just to test credit.

## Proof and release
- Require actual protected browser execution, live API and Supabase before/after. PASS only when all observed outcomes match; unexpected 403 or 503 are FAIL or BLOCKED, never PASS.
- No credit topup, financial approvals, actual bank/Stripe, coupon issuance/redemption, payroll, Auth resets, email, Storage changes or DB writes. No broad 236-case tests.
- New generic **single-case-only** workflow selects exactly ONE case spec changed by the squash-merge, rather than running all previous cases. FAIL if changed spec count is not exactly one.
- Successful read-only credit case does not prove payment/settlement correctness or full Production readiness. Those require bounded write E2E, verified recovery, approval and controlled release gates.
