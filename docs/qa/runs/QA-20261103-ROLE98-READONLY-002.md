# OilStation — Protected 98-role Login and Permission Matrix

**Run ID:** `QA-20261103-ROLE98-READONLY-002`  
**Plan:** `docs/qa/plans/2026-11-03-qa-role98-readonly.md`  
**Executed:** 3 November 2026 (Thailand time); real Chromium in protected GitHub Actions, no screenshots/traces/tokens persisted from authenticated users  
**Environment:** `https://oilstation.goldensoft.cloud`, same current Supabase `cxihsotcpdnalswfoysx`, fixed **4 stations / 12 corporate customer relationships**  
**PR:** [#120](https://github.com/nsomprasong/OilStation/pull/120), merged `2256655b79b78164340d5647e8114f23537b2ca3`

## 1. Preflight and safety

- Prior protected browser run `QA-20261103-POSTDEPLOY-READONLY-001` finished with 5 PASS, 2 known release-gated BLOCKED.
- Pre-run independent SQL counted fixed QA stations **4**, company account links **12**, employees **3**, wallet ledger **5**, audit events **254**, SaaS invoices **1**; payroll payouts/lines/bank export/refund/dispute/policy **0**.
- Cloudflare production-preview guards enforced before the run: `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`. No timed QA HR access or money workflow armed.
- Existing GitHub `oilstation-qa` protected secrets used by runner; no new Auth users, credentials or financial fixtures created.
- There is no verified independent full-database recovery drill; only read-only actions are in scope.

## 2. Actual browser execution

| Test | Scope and observed checks | Evidence | Result |
|---|---|---|---|
| ROLE-66 | 66 existing QA browser identities: 2 Sales, 4 station owners, 12 corporate admins, 12 issuers, 12 accountants, 12 corporate finance managers, 12 drivers. Each logs in through the new green/cream Login, verifies single membership/server scope, role-only menus and scoped GET/403 denial. No issuer QR created, no bank/finance write. | [GitHub Actions 41630683604](https://github.com/nsomprasong/OilStation/actions/runs/41630683604) | **PASS: 7 Playwright cases, 66 individual logins** |
| ROLE-32 | 32 existing QA identities: 4 organization owners, 4 billing managers, and 4 each station manager/cashier/attendant/pump staff/HR manager/station finance manager. Mobile 390x844 login, role menu visibility/denial, server-confirmed tenant scope, forbidden Sales endpoint 403. | [GitHub Actions 41630683665](https://github.com/nsomprasong/OilStation/actions/runs/41630683665) | **PASS: 32/32 Playwright cases and logins** |
| CI | Full PR checks, Playwright public smoke and isolated SQL checks | [PR #120](https://github.com/nsomprasong/OilStation/pull/120) | **PASS 12/12 workflows** |
| Release | Exact merged-commit guarded front-end deploy and health checks before protected browser runs | [Production Preview 41630683628](https://github.com/nsomprasong/OilStation/actions/runs/41630683628) | **PASS** |

**Total:** **98/98 existing fixed QA actor logins succeeded**, without unexpected access-control failures in executed role/menu/API tests. This count excludes `support01` by prior owner direction, and excludes any protected real-customer Super Admin identity. `ROLE-66` contains seven aggregate Playwright tests, not 66 separate `test()` declarations; the log records all 66 identity loops.

## 3. Independent post-run audit

- Cloudflare production Worker deployment `d6cc57e2-bca2-4cec-904a-30180d2cef2b`, deployed version `6a67311e-fb1c-4e98-b747-e17912a758bf` at 100%.
- Flags preserved: `OILSTATION_DEPLOY_TARGET=production`, `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`.
- Supabase post-run SQL found QA station IDs **4**, corporate account links **12**, employees **3**, wallet ledger **5**, audit rows **254**, SaaS invoices **1**, payroll lines **0**, payouts **0**, bank export batches **0**, refund journal **0**, dispute history **0**, payroll policies **0**. Every measured value matches the read-only baseline.
- Separate SQL privilege probe of 13 public HR payroll/advance/review functions found `anon_execute=false`, `authenticated_execute=false`; these routines are intended for trusted service-side access only.
- No test-created data and no cleanup performed; no user-approved QA reset or customer deletion.

## 4. Verdict and remaining conditions

**PASS: scoped 98-role authentication, access menus, tenant scope, negative reads, worker release safety and unchanged DB counts.**

**BLOCKED/NOT TESTED (not passed):** real station HR/finance transaction menus remain release-locked; payroll submission/approval/lock/payout, PromptPay or bank settlements, cross-company funding, full fuel redemption/photos/hold settlement, actual payroll leave/OT end-to-end settlement, Stripe multi-station recurring and refund/dispute provider E2E, LINE deliveries, full 236-case master UAT, backup/recovery drills and QA fixture cleanup/reset.

This run validates **read-only production-preview compatibility**, not a financial or payroll production go-live. Future transactional QA needs its own enumerated side-effect scope, documented rollback and verified recovery safeguards before writes.
