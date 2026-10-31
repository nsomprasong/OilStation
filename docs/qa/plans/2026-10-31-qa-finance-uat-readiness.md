# OilStation QA Finance UAT — evidence and release gates

Date: 2026-10-31. Branch: `feature/qa-wallet-photo-only-20261031`, PR #59.
Release policy: existing production business APIs remain gated. Simulated wallet feature flag must remain **OFF** until all QA prerequisites are ready.

## Evidence observed on EXISTING Supabase (read-only inspection)
- 4 fixed QA stations `QA-S01-A`, `QA-S01-B`, `QA-S02-A`, `QA-S02-B`.
- 12 fixed QA corporate customers, all **12 prepaid balances at zero**.
- 38 tagged QA Auth users: 2 Sales, 8 Organization roles, 28 Station roles.
- **0 of 60 required Corporate role QA identities are present**, blocking real Corporate-authenticated UAT.
- **0 enabled/positively priced station fuel products** in all 4 QA stations, blocking coupon issuance.
- Database **does NOT have** either `qa_topup_simulations` or `oilstation_plate_photo_status`; SQL migrations from PR #59 not yet applied to existing Supabase.
- `OILSTATION_QA_FINANCE_SIM_ENABLED=false` is committed in Worker configuration. No simulated topup has been posted to production by this work.

## Implemented and verified by CI (disposable PostgreSQL / mocked API)
- `QA Wallet Approval SQL Integration (isolated)`: invokes the actual SQL RPCs for scoped request -> pending queue -> different-station denial -> separate authorized reviewer -> approved ledger -> replay (no double credit) -> debt-first repayment -> rejection immutability -> signed coupon scope -> audit count -> no bank topup writes.
- JS API unit tests verify QA gate, roles, malformed requests, approval conflict, synthetic amount limits and preview route safeguards.
- New unit tests exercise HMAC-backed coupon viewer and exact station/company DB allowlist; no anonymous access to unrelated coupon links.
- Existing Topup/Fuel/Finance/Billing/Attendance/Migration CI checks plus public Chromium smoke execute independently.
- The public Playwright CI job **does not authenticate**; success does not constitute private finance UAT.

## Actual UAT: blocked until prerequisites, never silently mark PASS
1. Merge/deploy the reviewed code **only after CI checks pass**; preserve `OILSTATION_API_ENABLED=false`.
2. Apply and verify migrations `20261031200000` (Corporate QA role-scope), `20261031203000` (photo-only status/QA coupon-link scope) and `20261031204000` (simulated wallet); check database function privileges and Supabase advisor output.
3. Provision exactly 60 missing distinct QA Corporate Auth users using existing approved identity matrix and authorized Sales/Station workflow (not by direct table insert). Confirm roles, scopes, aliases, separate users, no non-QA access.
4. Station owner configures at least one enabled, positively priced fuel product on `QA-S01-A` and repeats other-station setup when testing each QA station. No changes to any non-QA station.
5. Independently confirm 12 QA balances, ledgers, reserved amounts, and receivables baseline. Recheck all strict allowlists and `QA_RUN_ID`. Turn on **only** `OILSTATION_QA_FINANCE_SIM_ENABLED=true` for this QA run once ready.
6. Configure protected GitHub environment secrets `OILSTATION_QA_C01_ADMIN_PASSWORD`, `OILSTATION_QA_S01A_OWNER_PASSWORD`, `OILSTATION_QA_EVIDENCE_PASSPHRASE`. Never print/store secrets in PR, screenshots, trace or test output. Use `workflow_dispatch` suite `authorized-qa-finance` on deployed `main`.
7. UAT automated script `e2e/qa.finance.pw.mjs` signs in with real QA Corporate/Station Owner identities, verifies the Finance screens, sends an **explicit simulated** 100 THB topup, confirms no pre-approval balance change, approves with a second actor, verifies idempotent ledger posting, issues a 50 THB QR reserve and verifies driver signed link/scan. No bank transfer.
8. Manual human-review portion: attendant uploads actual **QA fixture photo** of registered plate via private storage; a different authorized cashier/manager opens the original image and confirms the plate. OCR is not called. Start fueling and verify price locks.
9. Attach QA pump-meter and receipt photos, have a different authorized manager inspect **both original images**, enter actual numeric liters and gross amounts manually, approve each, and finish fueling once. Verify prepaid/reserved/debt/receivables + immutable ledger and audit, including replay, over-limit denial, wrong-company/wrong-station denial, rejection, concurrent duplicate and expired coupon scenarios.
10. Mark UAT PASS only after browser login + API + independent database ledger evidence. Otherwise BLOCKED/FAIL with exact failing case. Disable simulated finance gate when ending QA; do not delete QA records without a separate order.

## Human review vs image OCR
Google Vision is no longer on the active front-end or Worker evidence routes for plate/fuel photos; stored original images and a different authorized reviewer are required. The remaining legacy OCR schema/code should remain unreachable until explicitly removed by a separate migration; no dropping old data as part of this UAT.

## Constraints and reporting
- **Do not** simulate real bank receipt, set `bankReceived=true`, or treat synthetic QA credit as actual deposit.
- **Do not** activate normal production finance, Stripe, LINE, HR payroll or cron as a side effect.
- Restrict active amounts to QA fixture accounts; one synthetic topup must not exceed 50,000 THB, cumulative synthetic topups per company account must not exceed 100,000 THB.
- When UI or schema prerequisites are missing, fail closed and keep the outstanding UAT case BLOCKED.
