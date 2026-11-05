# OS-QA-ST-MEMBER-DEACTIVATE-CANCEL-008 — verified isolated browser

- Source [PR #166](https://github.com/nsomprasong/OilStation/pull/166) merged to main commit `3c8d90ef8a1224e38ddebdfbfa3225020c95f97a`.
- PR CI all **12/12** distinct workflows passed.
- Matching guarded Preview deploy [42006986698](https://github.com/nsomprasong/OilStation/actions/runs/42006986698): SUCCESS.
- Protected one-case Chromium [42006986846](https://github.com/nsomprasong/OilStation/actions/runs/42006986846): SUCCESS, **1/1 test in 11.3s**, selected only `e2e/qa.case-st-s01b-member-deactivate-cancel-008.pw.mjs`.
- Actor: `s01b-owner` station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, 390×844 mobile.
- Real log checkpoints: `AUTH_PASS`, `CONFIRM_UI_PASS`, `CANCEL_PASS`, `UNCHANGED_PASS`, `OWNER_PROTECTED_PASS`, `NO_WRITES`.
- Supabase read-only SELECT after run equals before: memberships **100**, same station memberships **7**, active manager **1**, invitations **2**, audit_events **258**, payroll_runs **0**.
- **PASS only for confirmation warning and cancellation.** No real member revocation or negative tenant permission API request was attempted; no live payroll history altered.
- Next proposed separate test: `OS-QA-ST-MEMBER-ROLE-WRITE-009` — a single synthetic, non-owner QA staff membership role change with verified recovery, database invariants and scoped audit, **not** yet authorized by this case's outcome or executed. Must protect payroll/fuel links and avoid changing any real staff account.
