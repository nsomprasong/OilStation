# QA-20261104-HR-PAYROLL-DUAL-REVIEW-002 — complete disposable SQL draft/review lifecycle

**Date:** 4 November 2026 (Thailand), **plan:** `docs/qa/plans/2026-11-04-payroll-dual-review-isolated.md`  
**PR:** https://github.com/nsomprasong/OilStation/pull/129  
**Environment:** Disposable PostgreSQL 16 runner, metadata-only mock public schema; **not connected to** Supabase Production `cxihsotcpdnalswfoysx`.

## Test evidence

- [HR payroll guarded draft and dual review SQL Action](https://github.com/nsomprasong/OilStation/actions/runs/41745406194): **PASS**.
- The PostgreSQL job applied the original `20261101230000` payroll draft/review functions, `20261101233000` attendance-provenance version, then `20261104063000` unreconciled-advance safeguard in that order. Tested the **real PL/pgSQL** with synthetic read-only readiness/attendance providers:
  - 8 approved-but-unpaid advances -> `PAYROLL_EVIDENCE_UNREVIEWED`; no payroll rows.
  - Incomplete punch provenance -> `PAYROLL_EVIDENCE_UNREVIEWED`.
  - Foreign station employee/actor -> `FORBIDDEN`.
  - Reconciled fictional evidence -> one `draft` run, period, salary line, all `payable=false`, `posted=false`, `paid=false`.
  - Duplicate employee/period salary line -> `DUPLICATE_PAYROLL_LINE`.
  - Self-approval -> `SELF_APPROVAL_FORBIDDEN`.
  - Foreign station reviewer -> `FORBIDDEN`.
  - Changed advance evidence before independent review -> `PAYROLL_SOURCE_CHANGED`.
  - Changed punch provenance before independent review -> `PAYROLL_SOURCE_CHANGED`.
  - Distinct station owner performs review -> run/period status `review` (not `approved` or `paid`). Second identical review is idempotent; audit count remains two.
  - Redrafting after review -> `PAYROLL_PERIOD_LOCKED`. Payroll payouts, bank exports and advance repayment ledger stay zero.
  - All synthetic roles, org, employee, periods, runs, lines and audit are rolled back. A subsequent query confirms empty payroll tables.
- [GitHub Checks](https://github.com/nsomprasong/OilStation/actions/runs/41745406684): **582/582 Node/API tests passed**.
- [Real public Chromium](https://github.com/nsomprasong/OilStation/actions/runs/41745406358): **7/7 passed**. Protected business HR suite intentionally skipped while live finance/HR QA gates remain off.
- Other isolated CI checks (Fuel, Stripe/Billing, Top-up, Admin, schema parity, etc.) all passed on source commit `c2d8f589397186c578b2187095ac68cb05aba9f0` before the report was added.

## Live Supabase production read-only status

- Organization `abqqqkqhujomuajjdnot` is **Free tier**; connected project reports `ACTIVE_HEALTHY`.
- Three synthetic QA employees exist, with S01-A showing exactly **eight approved advances, zero paid**. No actual deduction is justified.
- The production draft function still **lacks** the new `openAdvances` SQL guard because the forward-only migration has not been applied to the live database.
- Live payroll runs/lines/payouts, bank exports and advance repayments had all been confirmed zero; historical two QA leave records and their audit remain. No production writes were made in this run.
- Supabase Free tier does not provide the backup download option offered on paid plans; no independently verified logical backup + full restore is currently available. Connected Desktop Commander MY_HOME was offline when checked.
- **Do not equate this SQL PASS with a production financial release.** No real employee leave/OT entitlements, tax/social-security decisions, payment settlement, payroll close or file export were validated end-to-end.

## Verdict

**PASS:** SQL create/draft/independent review in a disposable database, tenant isolation, source immutability, idempotency, period lock, zero bank/ledger writes, Node suite and public Chromium.  
**BLOCKED:** live migration and authenticated live payroll writes pending a recoverable Production backup/rollback and legal reviewed wage policy.  
**NOT TESTED:** real payroll, real bank/PromptPay, automated tax calculations, statutory close and production release.

**Safe follow-up:** document secure off-platform backup, restore rehearsal (local isolated PostgreSQL; no separate Supabase staging required), and change-controlled migration apply/verify. Then bounded QA browser dual-account Payroll draft/review without bank payment.
