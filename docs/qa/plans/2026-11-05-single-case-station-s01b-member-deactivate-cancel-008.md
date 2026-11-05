# OS-QA-ST-MEMBER-DEACTIVATE-CANCEL-008 — protected dialog review only

- Continue after case 007 PASS, never rerun 001–007.
- Role: existing QA `s01b-owner`; one station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`; 390×844 mobile.
- Home → เชิญสมาชิก → existing manager → **ปิดสิทธิ์** button. Verify modal title, member identification, explicit warning that it does not delete Auth or fuel/shift/payroll histories, and confirm button. Click **ยกเลิก only**. Re-read scoped GET to prove member remains active and manager; owner cannot be deactivated through the UI.
- **Never click confirm or emit POST/PUT/PATCH/DELETE.** No invite, no actual revocation, no attendance/payroll mutation.
- Baseline: total memberships 100, s01b 7 (active manager 1), invitations 2, audit 258, payroll_runs 0. Check after-run again.
- Protected GitHub Environment `oilstation-qa` serial workflow selects exactly one new `e2e/qa.case-st-s01b-member-deactivate-cancel-008.pw.mjs` after matching guarded Preview deploy.
- This case is **not** positive deactivation UAT. Real role removal with revocation and preservation of past HR/fuel records needs a separately bounded QA mutation/recovery case.
