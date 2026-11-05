# OS-QA-ST-MEMBER-CROSS-SCOPE-DENIAL-010 — verified production Preview browser

- [PR #170](https://github.com/nsomprasong/OilStation/pull/170) merged as `78007c10e9cc226c126a934e994f1f4ca61b3327`.
- Matching guarded Preview [42013264723](https://github.com/nsomprasong/OilStation/actions/runs/42013264723) SUCCESS.
- Protected one-case Chromium [42013264806](https://github.com/nsomprasong/OilStation/actions/runs/42013264806): SUCCESS **1/1 in 18.0s**, selected only `e2e/qa.case-st-s01a-member-cross-scope-denial-010.pw.mjs`.
- Exact checkpoints: `AUTH_PASS` s01a owner only; `CROSS_SCOPE_WRITE_DENIED_PASS` 403 `permission_denied` on POST targeting s01b fake attendant with same role; `CROSS_SCOPE_READ_DENIED_PASS` 403 for s01b member directory.
- Supabase independent SELECT later: memberships 100, target station 7, audit_events 260 (unchanged from case 009's two authorized role transitions), payroll_runs 0.
- **PASS for one cross-station member-change denial and scoped directory isolation**, not for all tenancy or payroll cases.
