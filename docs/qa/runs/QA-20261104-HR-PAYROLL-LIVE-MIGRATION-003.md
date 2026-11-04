# QA-20261104-HR-PAYROLL-LIVE-MIGRATION-003 — production SQL guard installed

**Execution date:** 4 November 2026 (Thailand).  
**Target:** Existing OilStation Supabase project `cxihsotcpdnalswfoysx` — PRODUCTION.  
**GitHub main:** `79a80a2b6934936dd38dc5d4f27ee477bf63753b`.  
**Source migration:** `supabase/migrations/20261104063000_hr_payroll_unreconciled_advance_draft_guard.sql` (PR #128; already passed disposable PostgreSQL CI).  
**Live Supabase migration record:** version `20261104002339`, name `hr_payroll_unreconciled_advance_draft_guard_20261104`.  
**Authorization:** user explicitly instructed **"ข้าม backup"** after being told Supabase OilStation Free tier has no verified download/restore recovery. No snapshot, backup or recovery drill was performed; this is an accepted residual risk, NOT a backup success.

## Controlled change and verifications

1. Confirmed GitHub main and the deployed production Worker, prior CI pass from PR #128 and #129.
2. Pulled `pg_get_functiondef(public.hr_create_payroll_review_line)` from live production before change. The entire existing PL/pgSQL body **matched exactly** the canonical function body in `20261101233000_hr_payroll_manual_punch_provenance.sql` (7417 characters).
3. Verified the new function body differs only by the documented `COALESCE((v_evidence->>'openAdvances')::integer,-1)<>0` SQL guard and its explanatory comments; prior attendance/manual provenance and no-payment logic are retained.
4. Recorded pre-deploy baseline: payroll periods/runs/lines/payouts, bank exports, advance repayments = 0; wage policies = 0; wallet ledger = 5; audit events = 258; test leave requests = 2.
5. Applied non-destructive forward-only `CREATE OR REPLACE FUNCTION` through the Supabase **migration** tool; response `success:true`. No `INSERT`, `UPDATE`, `DELETE`, `DROP`, or external transfers in the applied migration statements (the function body of course retains its existing draft-time DML, which was not executed by migration).
6. Read-only post-migration introspection confirmed:
   - `has_advance_guard=true`, `attendance_provenance_preserved=true`;
   - `security_definer=true` and empty `search_path`;
   - `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`;
   - migration version registered in Supabase migration history.
7. Ran a production negative test using **only a read-only PostgreSQL transaction** with the existing fictional `QA261101S01A` employee and a scoped authorized station role. The real `hr_create_payroll_review_line` rejected the request with `PAYROLL_EVIDENCE_UNREVIEWED`; the test caught the exact expected error and terminated with rollback. Because its payroll policy, attendance and advances are all incomplete, the test establishes fail-closed behavior **not** that the unresolved-advances condition was the only blocker; its independent condition was proven in the disposable PostgreSQL 16 CI in PR #128.
8. Rechecked post-test database totals: periods/runs/lines/payouts/exports/advance repayments/wage policies = 0; wallet ledger 5, audit events 258, leave requests 2. No live financial row was added.
9. Cloudflare script `oilstation`: `OILSTATION_API_ENABLED=false`, `OILSTATION_QA_FINANCE_SIM_ENABLED=false`, no active `OILSTATION_QA_HR_UAT_ENABLED`. Latest prior Worker deployment `f84506a1-7808-4dbd-8a00-80533087b9c9` remains active. **This was a Supabase SQL change, not a Worker redeploy.**

## Rollback without a full backup

The previously deployed function body is available in the version-controlled `20261101233000_hr_payroll_manual_punch_provenance.sql`; that canonical function was verified byte-for-byte against the live body before this change. A rollback of **this function only** would require a reviewed `CREATE OR REPLACE FUNCTION` using that function definition and its same restricted grants, followed by a privilege/status check. This is **not** a backup of employee data or transactions. Do not roll back without a new, recorded change approval.

## Remaining blockers / scope boundaries

**PASS:** Production SQL function migration installed and permissions verified; real bounded negative scenario rejected; no new payroll/payment rows; original Payroll draft/review SQL integration previously exercised with independent actors on disposable PostgreSQL 16 (PR #129).

**NOT YET PASS:** Authenticated browser QA for production Payroll draft/review with two accounts; payroll policy approval (currently 0); independent statutory tax/social security review; two unreviewed QA punches; eight approved-but-undisbursed QA advances; actual period close and bank/PromptPay settlement. No real-money payment should be enabled without those decisions and an additional production release check.

**Note:** Supabase Organization's `Free` plan means provider backup download was unavailable at time of check. Owner opted out of a backup for this targeted function change. This does not remove the need to secure recoverability before eventual real financial go-live.
