# OS-QA-ST-MEMBER-ROLE-ESCALATION-DENIAL-011 — browser PASS

- [PR #171](https://github.com/nsomprasong/OilStation/pull/171) CI 12/12 successful, merged to main `95e8e589e58b58b6916cf3454de8b3170fc4e433`.
- Matching guarded Production Preview [42016796362](https://github.com/nsomprasong/OilStation/actions/runs/42016796362) SUCCESS.
- Protected single-case Chromium [42016796199](https://github.com/nsomprasong/OilStation/actions/runs/42016796199): SUCCESS, **1 passed in 7.7 seconds**. Selected only `e2e/qa.case-st-s01b-member-role-escalation-denial-011.pw.mjs`.
- Exact checkpoints: `AUTH_PASS`, `FIXTURE_PASS`, `ELEVATION_DENIED_PASS` HTTP 400 `invalid_member_change`, `UNCHANGED_PASS`. QA target role remains `attendant`, active.
- Independent live Supabase read-only counts after: memberships **100**, s01b members **7**, audit **260**, payroll_runs **0**, all equal pre-test baseline.
- PASS only for one unauthorized elevation request, not positive user role change or all permission combinations.
