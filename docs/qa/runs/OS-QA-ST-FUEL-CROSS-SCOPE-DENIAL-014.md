# OS-QA-ST-FUEL-CROSS-SCOPE-DENIAL-014 — real Chromium PASS

- [PR #174](https://github.com/nsomprasong/OilStation/pull/174), CI 12/12 successful, merged `e4f780d258ef455147124a311d89821a49ca30bc`.
- Matching guarded Preview [42019137479](https://github.com/nsomprasong/OilStation/actions/runs/42019137479) SUCCESS.
- Protected single-case Chromium [42019137721](https://github.com/nsomprasong/OilStation/actions/runs/42019137721) **PASS 1/1 (14.6s)**, only `e2e/qa.case-st-s01b-fuel-cross-scope-denial-014.pw.mjs`.
- Checkpoints `AUTH_PASS`, `FOREIGN_READ_DENIED_PASS` (403), `FOREIGN_WRITE_DENIED_PASS` (403), `UNCHANGED_PASS` (same own-station fuel price and enabled state).
- Intentional foreign station ID + own fuel product ID pairing prevented any legitimate foreign fuel price modification even if auth were misconfigured.
- Independent Supabase after run: total memberships 100; s01b 7; audit_events 260; payroll_runs 0, unchanged.
- **PASS for one station-owner foreign-station fuel read/write denial**, not pricing schedules, live pump settlement, or all tenancy cases.
