# OS-QA-ST-MEMBER-EDIT-UI-007 — authorized member editor: review and cancel only

- Prior successful cases: 002–006 recorded in `docs/qa/CONTINUATION-LEDGER-20261105.md`. Do not rerun any prior PASS.
- Actor: `s01b-owner` only, 390 × 844 mobile, exact station `76388e2c-ef36-4656-808b-7d0fbd1d2c35`.
- One action: Home → เชิญสมาชิก → existing member directory → open manager's role editor; verify exact six staff role options, original selected role, owner not editable; choose cashier in **unsubmitted draft**, cancel; reopen to assert original role and backend GET remain unchanged.
- All calls read only: `/api/me`, scoped `/api/members/directory`. Never click Save/Deactivate/Invite or send POST/PUT/PATCH/DELETE. No member updates, no payroll/HR changes.
- Real protected Chromium, only `e2e/qa.case-st-s01b-member-edit-ui-007.pw.mjs`, GitHub Environment `oilstation-qa`, after matching guarded Preview deploy.
- Supabase pre-baseline: memberships 100; s01b memberships 7; invitations 2; audit_events 258; payroll_runs 0. Recheck after browser.
- Separate valid member-role **write** must be tested later with explicitly bounded synthetic actor + recovery checks, not inferred from this cancel-only case.
