# OS-QA-ST-HR-PEOPLE-001 — Verified isolated browser run

- Source plan: `docs/qa/plans/2026-11-05-single-case-station-s01a-hr-people.md`
- Actor: one existing QA station owner `s01a-owner`; mobile 390×844; Home > HR > People only
- GitHub PR: [#157](https://github.com/nsomprasong/OilStation/pull/157); merged commit `ae84478f0ed491379f57e49c7c65ae99b0a4088b`
- Real protected Chromium run: [41983065736](https://github.com/nsomprasong/OilStation/actions/runs/41983065736); workflow SUCCESS, 1 Playwright test passed in 6.6 seconds
- GitHub observed log: `AUTH_PASS: station_owner /api/me scope checked`; `UI_PASS: mobile Home > HR > People, one pane`; `API_BLOCKED: GET /api/hr/roster 403 qa_identity_not_live`
- **Verdict: UI PASS; station scope AUTH PASS; HR BUSINESS FUNCTION BLOCKED**. Do NOT count this case as an end-to-end working HR data function. The live HR API deliberately excludes synthetic QA users. No writing endpoints called.
- Supabase baseline after run remained stations 5, companies 12, wallet ledger 5, fuel sessions 2, payroll runs/payouts 0, audit 258; counts showed no mutations from this case.
- No QA records created. Cleanup for this case: not applicable. Backup/recovery of shared production DB remains **NOT VERIFIED**.
- Next case assigned (separately): `OS-QA-ST-CUSTOMER-REPORT-002`; do not replay this HR visual/auth check.

**Go-live:** NOT READY — guarded preview, 236-case UAT and transactional HR/finance workflows remain unverified.
