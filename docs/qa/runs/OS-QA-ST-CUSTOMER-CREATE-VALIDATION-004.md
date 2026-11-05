# OS-QA-ST-CUSTOMER-CREATE-VALIDATION-004 — verified isolated browser regression

- Prior failure: [GitHub run 41990002860](https://github.com/nsomprasong/OilStation/actions/runs/41990002860): authorized New Company tab was missing; real UX bug.
- Small targeted correction: [PR #161](https://github.com/nsomprasong/OilStation/pull/161), squash merged to main commit `5cce152d89cb1464963da3c572e0bdb1b0bc7c1c`.
- CI on PR #161: 13/13 named workflows completed successfully (including Checks, browser E2E, SQL integration).
- Guarded Preview deploy: [41994519936](https://github.com/nsomprasong/OilStation/actions/runs/41994519936) SUCCESS.
- Actual isolated protected Chromium: [41994519937](https://github.com/nsomprasong/OilStation/actions/runs/41994519937) SUCCESS, 1/1 test in 6.1s; selected ONLY `e2e/qa.case-st-s01b-customer-create-004.pw.mjs`.
- Actor/scope: `s01b-owner`, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, viewport 390×844.
- Log evidence: `AUTH_PASS`, `FORM_PASS`, `REQUIRED_PASS`, `EMAIL_PASS`, `TAX_PASS`, `BILLING_DAY_PASS`, `NO_WRITES`.
- Actual Supabase SELECT post-run: stations 5; companies 12; company-station links 12 (s01b=3); wallet_ledger 5; fuel_sessions 2; payroll_runs 0; payroll_payouts 0; audit_events 258. All match case pre-baseline.
- **Verdict: PASS only for authorized mobile company-create form visibility and invalid-input client-side rejection.** No valid company, Admin invitation, credit posting, HR, or billing transaction was exercised.
- Do not rerun 004 or previously completed 002/003. Continue with separate case 005 for station member directory name/email/role search only.
