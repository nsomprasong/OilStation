# OS-QA-ST-FUEL-PRICE-INVALID-013 — real Chromium PASS

- [PR #173](https://github.com/nsomprasong/OilStation/pull/173) CI 12/12 successful, merged commit `2ce0e723802c3705277120d25d34731bc3b8e38f`.
- Matching guarded Preview [42018383000](https://github.com/nsomprasong/OilStation/actions/runs/42018383000) SUCCESS.
- Protected serial Chromium [42018383018](https://github.com/nsomprasong/OilStation/actions/runs/42018383018): **1 passed (7.4s)**. Selected only `e2e/qa.case-st-s01b-fuel-price-invalid-013.pw.mjs`.
- `AUTH_PASS`, `API_PASS`, `VALIDATION_PASS` for 0, -1, and 12.12345 price, `UNCHANGED_PASS` and `NO_WRITES`; live GET verified fuel price and enabled same as before.
- Independent Supabase after: memberships 100, s01b 7, audit_events 260, payroll_runs 0 — unchanged. No public pump prices modified.
- **PASS for invalid inputs in one existing QA station fuel price card only.** Positive price updates, future scheduling and corporate special rates remain separate UAT.
