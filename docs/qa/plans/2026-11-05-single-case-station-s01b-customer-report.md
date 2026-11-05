# OS-QA-ST-CUSTOMER-REPORT-002 — Station s01b Fuel Report, single case

**Scope:** One user account `s01b-owner`, one station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, one mobile screen `Customers`, one task tab `report`. Owner specifically prohibits rerunning completed tests. **No data writes**.

## Evidence and pre-test baseline (2026-11-05)
- Earlier wide run [41973619900](https://github.com/nsomprasong/OilStation/actions/runs/41973619900): Platform 8/8 read-only PASS, Corporate 32/32 read-only PASS, Station incomplete due runtime cap. In an earlier wide run, `s01b-owner customers/report` had a transient `one visible task` failure.
- Existing closed isolated `OS-QA-ST-HR-PEOPLE-001` passed UI + Auth but HR backend intentionally BLOCKED; [run 41983065736](https://github.com/nsomprasong/OilStation/actions/runs/41983065736). Do not re-run it.
- Supabase current: five stations, twelve companies and linked accounts, wallet ledger five entries, fuel sessions two globally, Payroll runs/payouts zero and audit 258.
- **s01b has no fuel_sessions records** (SELECT over `public.fuel_sessions` grouped by station and status returned empty). Accordingly a report correctly showing **zero completed fills** and empty state is expected; no need to simulate or insert fuel data.

## Single browser execution
1. Log in only `s01b-owner` through protected `OILSTATION_QA_REVIEW_PASSWORD`. Validate exact `/api/me` station owner membership (no other scope).
2. Mobile viewport 390×844. Home → ลูกค้าบริษัท → `รายงานเติมน้ำมัน` task. The report tab must be pressed and exactly one pane visible after asynchronous DOM settlement.
3. Verify real `GET /api/station/customer-overview` reports this station, then `GET /api/fuel/report` returns `rows=[]` for this station. UI must show actual empty state, report table and summary 0; never mock completed fills.
4. Enter nonexistent plate search term `QA-NO-MATCH-CASE-002`; click report search. Verify filtered GET, continued empty-state and no JS crashes/no non-GET business API requests.
5. Compare key production DB counts before/after, no changes except potential Auth login timestamp. Log only fixed QA alias, route paths, HTTP status and stable test markers — never bearer tokens or response rows.

## Explicitly out of scope
No station/customer creation, topup, wallet mutation, coupon issue/redeem, fuel start/finish, payroll, Stripe/bank actions, email or permissions changes. Backend GET release-gate errors are **BLOCKED**, not PASS.

## Exit
Record `UI_PASS`, `API_PASS` and `DB_NO_WRITE` only after protected Chromium evidence. If this case FAILs, inspect the exact failure and patch this page only; do not trigger all existing sweeps. Keep production flags unchanged.

**Release:** Continue remaining 236-case UAT ledger with distinct case IDs. Full API activation and financial release require controlled deploy release gates after end-to-end UAT and approved cleanup/recovery.
