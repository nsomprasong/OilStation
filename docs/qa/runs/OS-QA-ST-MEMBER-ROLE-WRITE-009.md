# OS-QA-ST-MEMBER-ROLE-WRITE-009 — production-confirmed PASS

- First real Chromium [42010773014](https://github.com/nsomprasong/OilStation/actions/runs/42010773014) **FAIL 1/1**: API 400 for allowed staff role. Supabase verified no membership changes or audit events (258). Root cause: PL/pgSQL clause p_role_code<>ANY(v_roles) was always true for allowed role arrays.
- [PR #169](https://github.com/nsomprasong/OilStation/pull/169), merged commit 88b147f174eb7243bace4f380776a16429df8dbf, fixes it to <>ALL(v_roles) by additive migration plus regression test; CI **12/12 success**.
- Applied exact reviewed migration to real OilStation Supabase via migration operation. SQL verification: corrected clause present, unsafe clause absent; service_role RPC EXECUTE yes, authenticated/anon no. No prior role changes.
- Matching guarded Preview [42012265059](https://github.com/nsomprasong/OilStation/actions/runs/42012265059) SUCCESS.
- Replayed only **failed case 009**, real protected Chromium [42012265036](https://github.com/nsomprasong/OilStation/actions/runs/42012265036) SUCCESS **1 passed (13.1s)**. Checkpoints AUTH_PASS, FIXTURE_PASS, REAL_WRITE_PASS, RECOVERY_PASS (restoration requests=1), TWO_BOUNDED_MUTATIONS.
- Supabase after: exact dedicated QA membership 65d3c545-59b3-4704-9f52-2133ec741e36 is active original attendant; count memberships 100, s01b 7, invitations 2, payroll_runs 0; audit_events increased 258→260 with **exactly two** audit transitions: attendant→pump_staff, pump_staff→attendant. HR links 0.
- **PASS for exact one QA role update and forced restoration only.** Not a broader member deactivation/HR/finance pass.
