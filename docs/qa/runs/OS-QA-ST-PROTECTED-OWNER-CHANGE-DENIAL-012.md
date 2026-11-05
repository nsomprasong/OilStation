# OS-QA-ST-PROTECTED-OWNER-CHANGE-DENIAL-012 — Chromium PASS

- [PR #172](https://github.com/nsomprasong/OilStation/pull/172) merged `9c0f30023a00f7e4b2ac55094b912c61a573d233`; all PR CI 12/12 PASS.
- Matching guarded Production Preview [42017569091](https://github.com/nsomprasong/OilStation/actions/runs/42017569091) SUCCESS.
- Protected one-case Chromium [42017569238](https://github.com/nsomprasong/OilStation/actions/runs/42017569238): **SUCCESS 1 passed (7.9s)**, selected only `e2e/qa.case-st-s01b-protected-owner-change-denial-012.pw.mjs`.
- Real checkpoints `AUTH_PASS`, `PROTECTED_FIXTURE_PASS`, `PROTECTED_ROLE_DENIED_PASS` (403 permission_denied) and `UNCHANGED_PASS`. Safe same-role edit request avoided even theoretical owner demotion if broken.
- Independent Supabase after test: memberships 100, station s01b 7, audit 260, payroll_runs 0, unchanged from before.
- PASS for protected owner API write rejection, not for all protected roles or role/deactivation positive writes.
