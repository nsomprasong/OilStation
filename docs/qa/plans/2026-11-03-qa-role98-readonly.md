# QA-20261103-ROLE98-READONLY-002 — post-login release role matrix

**Status:** APPROVED, read-only continuation by owner on 2026-11-03; no mutation authorized.
**Target:** https://oilstation.goldensoft.cloud — same existing Supabase `cxihsotcpdnalswfoysx` and current protected QA identities, **no staging**.
**Source test plan:** `docs/qa/plans/2026-10-31-oilstation-role-identity-matrix.md`.
**Previous phase:** `docs/qa/plans/2026-11-03-postdeploy-login-functional-readonly.md`, public Chromium 7/7 PASS and live functional Chromium 5 PASS, 2 BLOCKED under production release lock.

## Exact scope

- Protected main-branch workflows: `QA 66 existing accounts - read-only browser role verification`, `QA 32 remaining Station and Organization roles - read-only Chrome`.
- 66 role identities: 2 Sales, 4 station owners, and 12 each Corporate Admin, Issuer, Accountant, Finance and Driver.
- Additional 32 identities: four each Organization Owner, Organization Billing Manager, Station Manager, Cashier, Attendant, Pump Staff, HR Manager, Station Finance Manager.
- All identities are pre-existing QA actors; **Support01 excluded** per owner-approved matrix.
- Each is verified in real Chromium at 390x844 with the newly deployed `.os-auth-frame`, `.os-auth-hero`, and `.os-auth-card`, QA password login, actual server-returned single tenant scope and menu authorization; GET-only allowed/forbidden endpoints. No signing into production real-customer accounts.
- No screenshots, trace, video or tokens may be uploaded for authenticated browsers.

## Baseline and safety

- Source base after reviewed PR #119, at `0182c6f9341f072128ded2abedc62ed7dae6bea5`.
- Production Worker preview guard `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`; QA HR timebox not armed. `/api/ready` intentionally HTTP 503.
- Supabase read-only snapshot: exact fixed QA stations 4, corporate-station accounts 12, employees 3, wallet ledger rows 5, audit rows 254, SaaS invoices 1, payroll payouts 0, payroll lines 0, bank exports 0, refund/dispute rows 0, payroll policies 0.
- No independent restore/backup test was verified; therefore **zero intentional database writes** and no cleanup/deletion.
- No change to OAuth, credentials, payment processing, QR issue/redeem, wage calculations, RLS, payroll, or bank exports.

## Acceptance and evidence

1. PR CI PASS before merge; E2E read-only test files run only on protected main after same-commit production-preview deployment PASS.
2. Both QA workflows must complete with PASS or report specific failing identity; count actual 66+32 browser sessions, not only nominal number of test cases.
3. Confirm post-run Cloudflare guard flags and read-only Supabase counts unchanged. Negative tenant access must continue to return 403.
4. Report `BLOCKED` for live HR/Finance transactions that require release-gated endpoints; this read-only matrix never proves payroll/payment settlement.
5. Persist report `docs/qa/runs/QA-20261103-ROLE98-READONLY-002.md`, including URLs, commit, PASS/FAIL, and explicit untested scope.

**Excluded:** any Auth user creation, invitations, station/company/account creation, top-ups, fuel sessions, bank payments, PromptPay transfers, attendance/leave/OT changes, financial ledgers, real Stripe, notifications, cleanup, production business API activation and new secrets.
