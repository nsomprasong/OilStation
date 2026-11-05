# OS-QA-ST-MEMBER-ROLE-ESCALATION-DENIAL-011

- Continue after successful protected Chromium [case 010 run 42013264806](https://github.com/nsomprasong/OilStation/actions/runs/42013264806) and case 009 role write/recovery; do not rerun previous cases.
- Target: existing QA-only `s01b-owner` → API attempts to grant `platform_superadmin` role to exact fictional `qa-s01b-attendant@qa.oilstation.invalid` membership ID `65d3c545-59b3-4704-9f52-2133ec741e36`.
- Secure expectation: 400 `invalid_member_change` for disallowed role. Verify exact live GET before and after: QA member still `attendant`, active; no approved writes, no audit change, no payroll.
- This is a **rejected request**: do not make any successful role changes. Protected one-case serial Chromium after guarded Preview. No broad rerun.
- DB baseline before: memberships 100, s01b 7, audit 260, payroll_runs 0. Compare after.
