# OilStation — Post-deploy Login & Functional Read-only QA

**Run ID:** `QA-20261103-POSTDEPLOY-READONLY-001`  
**Plan:** `docs/qa/plans/2026-11-03-postdeploy-login-functional-readonly.md`  
**Executed:** 3 November 2026 (Thailand time), actual GitHub Actions real Chromium  
**Target:** `https://oilstation.goldensoft.cloud`; fixed production-backed Supabase project `cxihsotcpdnalswfoysx`  
**Source:** [PR #119](https://github.com/nsomprasong/OilStation/pull/119), merged commit `0182c6f9341f072128ded2abedc62ed7dae6bea5`

## 1. Pre-test read-only baseline

Before PR #119 the last deployed front-end came from PR #118 (`2cc592ca858af43e781fe272085ef5688c4488e8`). Cloudflare Worker deployment `4c28664c-d1b4-4282-bb4e-ff0c59d3281e`, 100% traffic. Bindings confirmed `OILSTATION_API_ENABLED=false`, `OILSTATION_DEPLOY_TARGET=production`, `OILSTATION_PREVIEW_LOGIN_ENABLED=true`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`.

Supabase read-only SELECT (fixed QA station IDs, no personal data) showed QA stations **4**, corporate-station accounts **12**, employees **3**, wallet ledger rows **5**, audit events **254**, SaaS invoices **1**, payroll payouts/lines/bank exports **0**, payroll policies **0**, refund/dispute events **0**. All changes in this QA PR are test and documentation only; no business write was approved.

## 2. Real browser executions

| Case | Evidence | Result |
|---|---|---|
| POST-LOGIN-01: deployed green/cream angled login, Google, Facebook, QA username/password, no signup; 360/390/430/768/1280/1440 px and overflow | [PR public Chromium run 41629488297](https://github.com/nsomprasong/OilStation/actions/runs/41629488297) — 7 @public cases | **PASS 7/7** |
| POST-SEC-01: unauthenticated Support API denial, invalid QA password, private HR/payee endpoints and production finance release lock | Same public run | **PASS** |
| POST-ROLE-01: both Sales own two stations; four station owners inspect actual fuel and price editor without saving | [protected main QA run 41629654134](https://github.com/nsomprasong/OilStation/actions/runs/41629654134) | **PASS** |
| POST-CORP-01: twelve Corporate Admin browser sessions; own driver/QR form GET 200; unrelated company GET 403; no QR issued | Protected main QA run | **PASS 12/12** |
| POST-PUMP-01: four cashiers open scan/pump workspace, without scanning or dispensing | Protected main QA run | **PASS 4/4** |
| POST-HR-01: payroll roster/review real GET | Protected main QA run: production `/api/hr/roster` returns release-gated 503 | **BLOCKED — no HR transaction activated** |
| POST-FIN-01: finance approval queue real GET | Protected main QA run: `/api/topup/pending` returns release-gated 503 | **BLOCKED — no finance transaction activated** |

Protected main run summary: **5 passed, 2 skipped with explicit BLOCKED diagnostics** out of seven Playwright cases. The `FUN-01` case covered Sales01/02, `FUN-02` all four owners, `FUN-03` all twelve corporate admins, and `FUN-04` all four cashiers. The same-commit production-preview deploy [41629654198](https://github.com/nsomprasong/OilStation/actions/runs/41629654198) completed successfully before protected QA began. PR CI: **12/12 workflows successful**.

## 3. Post-run verification and invariants

Cloudflare deployment after merge: `3c1ee35a-f329-4677-906d-80fabb979a58`, 100% version `cc6aa540-3478-43e0-a9df-dd4448b1fc46`. Worker `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`; no temporary HR enablement.

After live browser execution, independent Supabase read-only SELECT measured the same **4 stations, 12 corporate accounts, 3 employees, 5 wallet ledger, 254 audits, 1 SaaS invoice**, and **zero** payroll payouts, payroll lines, bank exports, HR payroll policies, Stripe refund/dispute events. No QA fixture was created or deleted in this run.

## 4. Cleanup and release verdict

- **Test execution:** PASS for 7 public browser cases and 5 authenticated functional cases, **BLOCKED for two release-gated menu/API cases**.
- **DB writes:** none intentionally performed, and inspected financial/audit counts unchanged.
- **Cleanup:** not applicable to this run (no created-object manifest); no broad QA reset.
- **Recovery drill:** not independently verified; therefore no destructive QA permitted.
- **Production deployment:** PASS as guarded preview only. **Financial/payroll go-live:** NOT APPROVED.
- **Still unproven:** master 236-case UAT, complete fueling/photo settlement, real GPS attendance-to-payroll and payout, real bank/LINE, Stripe renewals/refunds/disputes, all business transaction branches.

The next read-only regression is recorded separately under `QA-20261103-ROLE98-READONLY-002`; it covers the remaining fixed 98 role sessions without changing this verdict.
