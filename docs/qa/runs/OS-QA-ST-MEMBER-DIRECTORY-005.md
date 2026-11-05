# OS-QA-ST-MEMBER-DIRECTORY-005 — verified isolated browser run

- PR: [#162](https://github.com/nsomprasong/OilStation/pull/162), merged to main commit `468061590f57063d5752b5752e819fddf97825a3`.
- Guarded Preview deploy [41995524422](https://github.com/nsomprasong/OilStation/actions/runs/41995524422): SUCCESS.
- Real protected Chromium [41995524307](https://github.com/nsomprasong/OilStation/actions/runs/41995524307): SUCCESS, 1/1 Playwright test in **9.8s**. Only selected `e2e/qa.case-st-s01b-member-directory-005.pw.mjs`.
- Actor: `s01b-owner` for station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, 390×844 viewport.
- Verified log checkpoints: `AUTH_PASS`, `API_PASS`, `DIRECTORY_PASS`, `SEARCH_PASS`, `EMPTY_AND_RESET_PASS`, `NO_WRITES`.
- Supabase independent SELECT for the same s01b station showed **7 active member rows** (one owner, one manager, one cashier, one attendant, one pump staff, one HR manager, one finance manager).
- Scope of PASS: live station-scoped member listing table and one in-card search/filter, empty state and reset. No new invitation, role edit, deactivation, QA account creation or HR employee changes tested; these remain separate UAT.
- Continue with case 006 (mobile invite drawer and invalid input validation); do not re-execute 005 or prior passed cases.
