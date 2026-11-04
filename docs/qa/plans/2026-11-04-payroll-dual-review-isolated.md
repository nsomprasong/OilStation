# QA-20261104-HR-PAYROLL-DUAL-REVIEW-002 — isolated transaction lifecycle

**Scope:** Continue owner-authorized HR/Payroll QA. **No new production Supabase data or migrations.** Live project remains `cxihsotcpdnalswfoysx` on free organization tier; independent backup/recovery unavailable for verification via connected tools.  
**Production baseline:** `main` = `590a40541670b1e02202627dae98f7d6df8d0e55` (PR #128 merged), Worker guarded, salary APIs disabled. 8 synthetic salary advances marked approved, none paid for S01-A. Existing production `hr_create_payroll_review_line` is still **unmigrated**, so new guard is only tested in disposable PostgreSQL.

## Tasks / minimum evidence

1. Load metadata-only Public Schema fixture into **throwaway PostgreSQL 16** with zero customer rows.
2. Apply the existing salary draft/review functions and manual attendance-provenance definitions, then the proposed forward-only open-advance SQL guard.
3. Create fake organization/station, two independent authorized staff accounts, a foreign-station account, and one synthetic employee **inside an explicitly rolled-back test transaction**.
4. Stub readiness and reviewed attendance evidence to valid, deterministic fictional data. Run true SQL RPCs:
   - blocked when approved-but-unpaid advance remains open, absent evidence, or incomplete attendance;
   - one safe draft, no payout/advance-repayment row;
   - reject same employee/period duplicate;
   - reject self-review, foreign station actor and stale source or attendance provenance;
   - independently review once; replay is idempotent; payroll run remains status `review`, never `paid` or `paying`; block re-draft after review.
5. Keep original `13` PR CI tests running, normal Unit/API and public Chromium. Confirm no authenticated live browser POST or finance toggle.
6. Preserve a run report in `docs/qa/runs/` and track exact CI artifacts. Do not call `ready_for_review` a financial approval.

## Explicit exclusions

No change to station-specific wage/leave/OT policies, statutory defaults, payee bank account, actual advance cash transfer, payroll production rows, Supabase Auth users, Storage, Stripe, LINE, bank files, or financial ledger; no backup claims. This test does not authorize applying any migration to the existing Production DB or toggling API flags.

## Post-check

Read-only Supabase baseline counts and Cloudflare flags, PR CI pass, guarded Worker deployed if merge approved. No cleanup: disposable database is destroyed after CI; rollback inside test is an additional integrity check.
