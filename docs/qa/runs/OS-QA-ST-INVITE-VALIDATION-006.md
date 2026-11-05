# OS-QA-ST-INVITE-VALIDATION-006 — verified isolated browser run

- PR [#163](https://github.com/nsomprasong/OilStation/pull/163) merged to main as `3d78d687bbe6f4a557acbb00c09a907ca8cc2132`.
- PR CI latest 12 distinct workflows: all SUCCESS.
- Guarded Production Preview [41996206908](https://github.com/nsomprasong/OilStation/actions/runs/41996206908): SUCCESS.
- Real protected Chromium [41996206907](https://github.com/nsomprasong/OilStation/actions/runs/41996206907): SUCCESS, exactly 1/1 Playwright test, **6.1 seconds**.
- Runner selected ONLY `e2e/qa.case-st-s01b-invite-validation-006.pw.mjs`.
- Actor: existing fictional `s01b-owner`, station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`, mobile 390×844.
- Verified log: `AUTH_PASS`, `DRAWER_AND_ROLES_PASS` (six staff roles; station_owner not selectable), `REQUIRED_PASS`, `EMAIL_PASS`, `CLOSE_PASS`, `NO_WRITES`.
- Supabase actual SELECT before **and after** run: invitations 2, memberships 100, audit_events 258, corporate_companies 12, all unchanged.
- **Verdict: PASS for invitation drawer, role choices, native empty/malformed email rejection and cancellation only.** Does not prove sending/accepting an actual invitation or creating/updating a role. Do not retry 006 without a targeted implementation change.
- Next separate case candidate: station-owner member role editor dialog review/cancel, no mutation (case 007), then a separate explicitly bounded write/rollback test for role changes and onboarding.
